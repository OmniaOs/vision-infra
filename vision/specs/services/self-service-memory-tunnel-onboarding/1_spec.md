# Especificación Técnica: Onboarding self-service al túnel de memoria compartida

## Metadata

```yaml
status: pending
version: 1
last_updated: 2026-09-23
category: services
```

## Historial de Cambios

- [ADDED] 2026-09-23: Versión inicial de la especificación.

## Naturaleza de Este Documento

Igual que `port-exposure-alerts`, esta spec mezcla runbook operativo (consola de Coolify, panel admin de Vaultwarden, `authorized_keys` en el VPS) con código real y completo (`vault/docker-compose.yml`, `memory/setup/windows.ps1`). Quien ejecute `/executespec self-service-memory-tunnel-onboarding` debe crear los archivos de código tal como se describen aquí (o una revisión justificada, documentada con `[CHANGED]`), y reportar como bloqueados los pasos que requieran acceso real a Coolify/VPS si no los tiene.

## Invariantes

- **INV-1**: `vault` (Vaultwarden) publica su puerto solo en `127.0.0.1` del VPS, igual que `gateway`, `memory` y `metrics-hub`. El acceso remoto es exclusivamente vía el dominio autenticado de Coolify/Traefik — nunca puerto directo.
- **INV-2**: cada persona tiene **exactamente una** llave SSH, ligada a su identidad, autorizada una única vez bajo `visiontunnel`. Un cambio de equipo físico nunca requiere una nueva autorización del admin — solo que la persona vuelva a correr el script de setup en la máquina nueva.
- **INV-3**: la llave privada SSH vive en exactamente dos lugares: `~/.ssh/` de la persona (local) y su item personal en Vaultwarden. Nunca se commitea, nunca se envía por chat/email en texto plano, y el admin no necesita (ni tiene, por diseño) acceso a ella — ver INV-8.
- **INV-4**: Vaultwarden corre con `SIGNUPS_ALLOWED=false`. Solo se entra por invitación explícita del admin — no hay registro abierto.
- **INV-5**: el mecanismo de autoarranque del túnel (tarea programada de Windows) reutiliza `memory/tunnel.sh` sin modificarlo — lo envuelve en un bucle de reintento, no reimplementa la invocación de `ssh`.
- **INV-6**: `memory/setup/windows.ps1` es idempotente — volver a correrlo en una máquina ya configurada detecta lo que ya existe (llave local, tarea programada, variables de entorno) y solo completa lo que falta, sin duplicar tareas ni sobrescribir una llave que ya funciona.
- **INV-7**: las variables `OMNIA_MEMORY_*` se fijan en scope **User** (`[Environment]::SetEnvironmentVariable(..., "User")`), nunca en `Machine`. El script nunca requiere una sesión elevada (admin de Windows) en la máquina del dev.
- **INV-8**: el admin nunca tiene, en ningún paso de esta feature, acceso de lectura a la llave privada de otra persona. Vaultwarden custodia cada llave en un item **personal** (no en una colección compartida de la organización) — el rol del admin es invitar personas y autorizar claves públicas, nunca ver material privado.

## Stack Técnico

- **Vaultwarden** (`vaultwarden/server:latest`) — servidor self-hosted compatible con el protocolo/API de Bitwarden, en Rust. Reutiliza el mismo patrón de despliegue Docker Compose que `gateway/`, `memory/` y `metrics-hub/`.
- **Bitwarden CLI** (`bw`) en la máquina de cada dev — cliente oficial, compatible con cualquier servidor Bitwarden-API incluido Vaultwarden vía `bw config server <url>`. Se instala vía `winget install Bitwarden.CLI` (sin depender de que la máquina tenga Node instalado).
- **PowerShell 5.1+** — nativo de Windows, sin dependencias nuevas.
- **Windows Task Scheduler** (`Register-ScheduledTask`) para el autoarranque del túnel — se prefiere sobre un servicio de Windows real (que requeriría NSSM u otra herramienta de terceros) porque corre en contexto de usuario sin necesitar privilegios de administrador, cumpliendo INV-7.
- Reutiliza **Git Bash** + `memory/tunnel.sh` sin modificarlos (INV-5) — cero lógica de SSH nueva.

## Modelo de Datos

No hay entidades de aplicación. Los artefactos relevantes son tres: el compose de Vaultwarden, el archivo de conexión que el script genera, y la convención de nombre del item en Vaultwarden.

```yaml
# vault/docker-compose.yml
#
# Vaultwarden -- custodia de llaves SSH del equipo para el tunel de memoria
# compartida (server Bitwarden-compatible, self-hosted).
#
# SEGURIDAD (mismo patron post-incidente 20-jul-2026 que gateway/memory/
# metrics-hub): puerto publicado solo en 127.0.0.1 -- acceso remoto por
# dominio autenticado (Traefik + Coolify), nunca puerto abierto a internet.
# SIGNUPS_ALLOWED=false: solo se entra por invitacion del admin (INV-4).
services:
  vault:
    image: vaultwarden/server:latest
    restart: unless-stopped
    environment:
      - DOMAIN=${VAULT_DOMAIN}
      - ADMIN_TOKEN=${VAULT_ADMIN_TOKEN}
      - SIGNUPS_ALLOWED=false
      - INVITATIONS_ALLOWED=true
      - WEBSOCKET_ENABLED=true
      - SMTP_HOST=${SMTP_HOST:-}
      - SMTP_FROM=${SMTP_FROM:-}
      - SMTP_PORT=${SMTP_PORT:-587}
      - SMTP_USERNAME=${SMTP_USERNAME:-}
      - SMTP_PASSWORD=${SMTP_PASSWORD:-}
    ports:
      - "127.0.0.1:8222:80"
    volumes:
      - vault_data:/data

volumes:
  vault_data:
```

```
# memory/.memory.env -- generado por memory/setup/windows.ps1, NO se commitea
# (ya ignorado en memory/.gitignore).
OMNIA_MEMORY_MCP_URL=http://localhost:8765/mcp/claude/sse/<proyecto>
OMNIA_MEMORY_GLOBAL_MCP_URL=http://localhost:8765/mcp/claude/sse/omnia-global
OMNIA_MEMORY_TOKEN=<token entregado por el admin o leido del vault>
OMNIA_MEMORY_SSH_HOST=148.113.203.22
OMNIA_MEMORY_SSH_USER=visiontunnel
OMNIA_MEMORY_SSH_KEY=<ruta local a la llave privada>
OMNIA_MEMORY_TUNNEL_PORTS=8765
```

**Convención de item en Vaultwarden**: un item de tipo Secure Note por persona, nombrado exactamente `omnia-memory-tunnel-ssh-key`, en su vault **personal** (no en una colección de organización — INV-8), con la llave privada como adjunto de archivo. El script busca ese nombre exacto vía `bw get item`.

## Alternativas Consideradas

1. **SSH CA propia (`step-ca`) o Teleport.** Evaluadas en la conversación que originó esta spec: resuelven el mismo problema (certificados de corta duración, login con password/SSO) pero son infraestructura nueva que hay que asegurar y mantener — desproporcionada para el tamaño actual del equipo. Quedan como opción a revisar si el equipo crece lo suficiente para justificar el costo de mantenimiento.
2. **Password auth directo sobre SSH.** Descartado de raíz: es el mismo tipo de superficie (credencial adivinable/de fuerza bruta) que la política post-incidente eliminó a propósito en el mismo servidor que ya sufrió un RCE.
3. **Colección compartida de la organización en Vaultwarden** (el admin ve todas las llaves privadas). Descartada en favor de items personales (INV-8): el admin no necesita ni debe tener acceso de lectura al material privado de cada persona — su rol es administrar la lista de invitados y las claves públicas autorizadas en el servidor, no custodiar las privadas.
4. **Servicio de Windows real (NSSM u otro wrapper) para el túnel**, en vez de Tarea Programada. Descartado: agrega una dependencia de terceros a instalar en cada máquina cuando el Task Scheduler nativo de Windows ya cubre "correr algo en background, reintentando, al iniciar sesión" sin instalar nada adicional.
5. **Reimplementar la conexión SSH en PowerShell** en vez de envolver `memory/tunnel.sh`. Descartado: `tunnel.sh` ya maneja `ExitOnForwardFailure`, `ServerAliveInterval` y la expansión de `~` de forma probada; duplicar esa lógica en PowerShell sería mantener dos implementaciones del mismo túnel sin necesidad (INV-5).

## Algoritmo

### Paso 0 — Prerrequisitos (admin, una vez)

1. Confirmar acceso a la consola de Coolify (mismo acceso ya usado en `expose-metrics-hub-domain`).
2. Generar el hash del token admin de Vaultwarden:
   ```bash
   docker run --rm vaultwarden/server:latest /vaultwarden hash
   # pide la contraseña admin por stdin; imprime un hash argon2 para pegar
   # en VAULT_ADMIN_TOKEN. La contraseña en texto plano no se guarda en
   # ningún archivo -- mismo principio que INV-5 de expose-metrics-hub-domain.
   ```
3. Elegir el dominio (`vault.omniaos.ai`, reutilizando el wildcard `*.omniaos.ai` ya usado por `gateway`/`memory`/`metrics-hub` si existe).

### Paso 1 — Crear `vault/docker-compose.yml` y `vault/.env.example`

Contenido de `vault/docker-compose.yml`: ver "Modelo de Datos" arriba.

```bash
# vault/.env.example
# Vaultwarden -- secrets/config. Copiar a .env y rellenar en Coolify (secrets).
# NO commitear .env.
VAULT_DOMAIN=https://vault.omniaos.ai
# Hash argon2 del token admin -- ver Algoritmo Paso 0.2 de 1_spec.md.
VAULT_ADMIN_TOKEN=
# SMTP opcional -- si se deja vacio, las invitaciones se copian a mano desde
# el panel /admin (Vaultwarden loguea el link de invitacion si no hay SMTP).
SMTP_HOST=
SMTP_FROM=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
```

### Paso 2 — Agregar el recurso en Coolify y el dominio

1. Nuevo recurso Coolify, Docker Compose, build desde `vault/`.
2. Domains for `vault`: `https://vault.omniaos.ai` (**con esquema**, mismo gotcha ya documentado en `DEPLOY_COOLIFY.md` para `metrics-hub`/`gateway` — sin él, Coolify genera `Host('')` y Traefik responde `503`).
3. Deploy.

### Paso 3 — Actualizar `infra/vps/omnia-portblock.sh`

```diff
- for p in 3000 4000 4320 8765 6333; do
+ for p in 3000 4000 4320 8765 6333 8222; do
```

Copiar a mano a `/usr/local/sbin/omnia-portblock.sh` en el VPS y `systemctl restart omnia-portblock` (mismo proceso manual ya documentado en `infra/vps/README.md` — esta spec no automatiza ese despliegue, hereda el gap ya conocido).

### Paso 4 — Configurar Vaultwarden (panel `/admin`)

1. Entrar a `https://vault.omniaos.ai/admin` con el token del Paso 0.
2. Confirmar `Signups allowed: No` (INV-4).
3. Crear la organización del equipo (ej. "Omnia").
4. Por cada persona: invitarla (email), y una vez acepte, subir su llave privada (Paso 5) como adjunto en su item personal `omnia-memory-tunnel-ssh-key`.

### Paso 5 — Alta de una persona (runbook, admin + persona)

1. Admin genera el par de llaves (o la persona lo genera y manda solo la pública):
   ```bash
   ssh-keygen -t ed25519 -C "<email>@omniaos.ai" -f id_ed25519_omnia_memory
   ```
2. Admin autoriza la **pública** bajo `visiontunnel` en `server-omniaplatform` (`~visiontunnel/.ssh/authorized_keys`) — una vez, nunca por dispositivo (INV-2).
3. Admin sube la **privada** al item personal de esa persona en Vaultwarden (Paso 4.4). La privada nunca se manda por chat/email (INV-3).
4. La persona corre `memory/setup/windows.ps1` (Paso 6) en cada máquina que use — sin volver a involucrar al admin (Escenario B de `0_contract.md`).

### Paso 6 — `memory/setup/windows.ps1`

```powershell
<#
  memory/setup/windows.ps1
  Setup self-service del tunel a la memoria compartida de Omnia (Windows).
  Correr UNA VEZ por maquina. Reejecutarlo en una maquina ya configurada es
  seguro (idempotente): detecta lo que ya existe y solo completa lo que falta.
#>

param(
  [string]$VaultServer = "https://vault.omniaos.ai",
  [string]$SshHost = "148.113.203.22",
  [string]$Proyecto = "vision-infra"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$sshDir = "$HOME\.ssh"
$keyPath = "$sshDir\id_ed25519_omnia_memory"
$envFile = "$repoRoot\memory\.memory.env"
$taskName = "OmniaMemoryTunnel"

function Test-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host "== Paso 1/6: prerrequisitos =="
if (-not (Test-Path "C:\Program Files\Git\bin\bash.exe")) {
  throw "No encuentro Git Bash. Instala Git for Windows: https://git-scm.com/download/win"
}
if (-not (Test-Command "bw")) {
  Write-Host "Bitwarden CLI no encontrado. Instalando via winget..."
  winget install --id Bitwarden.CLI -e --accept-source-agreements --accept-package-agreements
}
bw config server $VaultServer | Out-Null

Write-Host "== Paso 2-3/6: login a Vaultwarden + llave SSH =="
if (-not (Test-Path $keyPath)) {
  $email = Read-Host "Tu email de Omnia (el que te invito el admin a Vaultwarden)"
  bw login $email
  $session = bw unlock --raw
  if (-not $session) { throw "No se pudo desbloquear el vault. Reintenta." }

  bw sync --session $session | Out-Null
  $item = bw get item "omnia-memory-tunnel-ssh-key" --session $session | ConvertFrom-Json
  if (-not $item) { throw "No encuentro el item 'omnia-memory-tunnel-ssh-key' en tu vault. Pidele al admin que te invite y suba tu llave (ver Algoritmo Paso 4-5 de 1_spec.md)." }

  New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
  $attachmentId = $item.attachments[0].id
  bw get attachment $attachmentId --itemid $item.id --output $keyPath --session $session | Out-Null
  icacls $keyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
  bw lock | Out-Null
} else {
  Write-Host "Ya existe una llave local ($keyPath) -- se omite el paso de Vaultwarden."
}

Write-Host "== Paso 4/6: escribiendo memory\.memory.env =="
$token = Read-Host "OMNIA_MEMORY_TOKEN (te lo pasa el admin, o esta en tu vault junto a la llave)" -AsSecureString
$tokenPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

@"
OMNIA_MEMORY_MCP_URL=http://localhost:8765/mcp/claude/sse/$Proyecto
OMNIA_MEMORY_GLOBAL_MCP_URL=http://localhost:8765/mcp/claude/sse/omnia-global
OMNIA_MEMORY_TOKEN=$tokenPlain
OMNIA_MEMORY_SSH_HOST=$SshHost
OMNIA_MEMORY_SSH_USER=visiontunnel
OMNIA_MEMORY_SSH_KEY=$keyPath
OMNIA_MEMORY_TUNNEL_PORTS=8765
"@ | Set-Content -Encoding utf8 $envFile

Write-Host "== Paso 5/6: registrando el tunel como tarea de autoarranque =="
$bashExe = "C:\Program Files\Git\bin\bash.exe"
$loopCmd = "cd '$repoRoot' && while true; do bash memory/tunnel.sh; sleep 5; done"
$action = New-ScheduledTaskAction -Execute $bashExe -Argument "-lc `"$loopCmd`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -RunLevel Limited -Force -Description "Tunel SSH persistente a la memoria compartida de Omnia" | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "== Paso 6/6: variables de entorno persistentes de usuario =="
foreach ($line in Get-Content $envFile) {
  $k, $v = $line -split '=', 2
  [Environment]::SetEnvironmentVariable($k, $v, "User")
}

Write-Host ""
Write-Host "Listo. Cierra y vuelve a abrir tu IDE para que tome las variables nuevas."
Write-Host "El tunel ya corre en background (tarea '$taskName') y se reconecta solo."
```

### Paso 7 — Verificación

1. Confirmar que la tarea `OmniaMemoryTunnel` está `Running`: `Get-ScheduledTask -TaskName OmniaMemoryTunnel | Get-ScheduledTaskInfo`.
2. Confirmar `netstat -an | findstr 8765` escuchando en `127.0.0.1`.
3. Abrir un IDE nuevo (Claude Code u otro) y confirmar que `omnia-memory`/`omnia-memory-global` conectan sin error `INVALID_CONFIG`.
4. Reiniciar la máquina y confirmar que el túnel vuelve solo, sin correr el script de nuevo (Escenario E).

### Paso 8 — Documentar

Actualizar `memory/INSTRUCTIVO.md` (flujo self-service como recomendado, manual como fallback) y `DEPLOY_COOLIFY.md` (sección `vault/`, orden de deploy: `gateway/` → `vault/` → `memory/` → `metrics-hub/`, ya que `memory/setup/windows.ps1` depende de que `vault/` exista).

### Paso 9 — Rollback

1. Si `vault/` falla en Coolify: quitar el dominio agregado y detener el recurso — no afecta a `gateway`/`memory`/`metrics-hub`, que no dependen de él en runtime.
2. Si el script de setup deja un estado inconsistente en una máquina: `Unregister-ScheduledTask -TaskName OmniaMemoryTunnel -Confirm:$false`, borrar `memory/.memory.env`, y volver al flujo manual (`bash memory/tunnel.sh` + `source`) documentado como fallback en `memory/INSTRUCTIVO.md` — nunca queda una máquina sin ninguna vía de acceso.

## Manejo de Errores

| Señal | Escenario | Comportamiento esperado | Acción |
|---|---|---|---|
| `bw login` falla / timeout | Servidor de Vaultwarden aún no desplegado, URL mal escrita, o credenciales incorrectas | El script se detiene en el Paso 2 sin escribir `.memory.env` ni registrar la tarea | Confirmar `VaultServer` y que `vault/` está desplegado (Escenario G) |
| `bw get item` devuelve vacío | El admin todavía no subió la llave de esta persona a su item de Vaultwarden | Mensaje explícito pidiendo contactar al admin (Paso 5 de `1_spec.md`) | Admin completa el Paso 4-5 del Algoritmo |
| `Register-ScheduledTask` falla | Política de grupo bloquea Task Scheduler en esa máquina (infrecuente en laptops de equipo) | Error de PowerShell no capturado silenciosamente — el script debe fallar visible, no continuar como si el túnel estuviera activo | Correr el flujo manual (`bash memory/tunnel.sh`) como fallback documentado |
| Conexión directa a `148.113.203.22:8222` se establece desde fuera del VPS | Regresión de la política post-incidente (Escenario H) | Nunca debe pasar tras esta feature | Revisar `docker-compose.yml` de `vault` (binding) y estado de `omnia-portblock` vía OCC antes de continuar |
| Script re-ejecutado en máquina ya configurada duplica la tarea o pide login de nuevo | Falla de idempotencia (viola INV-6) | No debería ocurrir — el script chequea `Test-Path $keyPath` antes de tocar Vaultwarden, y `Register-ScheduledTask -Force` sobreescribe en vez de duplicar | Si ocurre, es un bug de implementación a corregir antes de cerrar la feature, no un comportamiento aceptable |
| `winget install Bitwarden.CLI` falla (máquina sin winget o sin permisos) | Windows viejo sin App Installer, o política corporativa | El script no puede continuar sin `bw` | Instalar `bw` manualmente (`npm install -g @bitwarden/cli` si hay Node, o descarga oficial desde bitwarden.com) y volver a correr el script |

## Resumen Ejecutivo

Checklist de implementación (a ejecutar por quien corra `/executespec self-service-memory-tunnel-onboarding`):

- [ ] Crear `vault/docker-compose.yml` y `vault/.env.example` (Paso 1).
- [ ] Desplegar el recurso `vault` en Coolify con dominio `https://vault.omniaos.ai` (Paso 2) — bloqueado sin acceso real a Coolify.
- [ ] Actualizar `infra/vps/omnia-portblock.sh` e `infra/vps/README.md` (Paso 3) — el despliegue al VPS real es manual y bloqueado sin acceso SSH/OCC.
- [ ] Configurar Vaultwarden vía `/admin` (Paso 4) — bloqueado sin el recurso desplegado.
- [ ] Crear `memory/setup/windows.ps1` con el contenido del Paso 6 (o una revisión justificada, documentada con `[CHANGED]`).
- [ ] Crear `memory/setup/README.md` documentando el flujo.
- [ ] Actualizar `memory/INSTRUCTIVO.md` y `DEPLOY_COOLIFY.md` (Paso 8).
- [ ] Validar el alta de al menos una persona real de punta a punta (Paso 5 + 7) antes de cerrar la feature.
- [ ] Correr `/onspecomplete self-service-memory-tunnel-onboarding` una vez validado todo lo anterior.

Nota: los pasos de Coolify/VPS/Vaultwarden admin requieren acceso real de Daniel — si `/executespec` corre sin ese acceso, debe crear los archivos de código (compose, script, docs) y reportar como bloqueados los pasos operativos, igual que el precedente de `expose-metrics-hub-domain`.
