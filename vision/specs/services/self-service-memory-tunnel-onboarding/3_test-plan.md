# Plan de Testing: Onboarding self-service al túnel de memoria compartida

## Metadata

```yaml
test_framework: ninguno (validación manual, contra Coolify/VPS/Vaultwarden reales y una máquina Windows real)
version: 1
last_updated: 2026-09-23
```

## Estrategia de Testing

Igual que `expose-metrics-hub-domain`, esta feature es mayormente una acción operativa de infraestructura (consola de Coolify, panel admin de Vaultwarden) más un script real que no tiene sentido probar con un mock — su valor está precisamente en que toca el sistema de archivos, el registro de tareas de Windows y una red real. El repo no tiene harness de test automatizado (`Testing: ninguno configurado todavía`, constitution), así que este plan es enteramente manual, ejecutado por quien tenga acceso a Coolify, al VPS y a una máquina Windows.

## Validación Manual

Ejecutar en orden. Reemplazar `<dominio>` por `vault.omniaos.ai` una vez confirmado.

### Paso 1 — Vaultwarden accesible y sin registro abierto (cubre AC-002, AC-003)

```bash
curl -i https://<dominio>/
# Esperado: 200, HTML de login de Vaultwarden.

curl -i https://<dominio>/identity/accounts/register -X POST -d '{}'
# Esperado: rechazo (400/404 según versión) -- SIGNUPS_ALLOWED=false.
```

### Paso 2 — Puerto directo bloqueado (cubre AC-001, AC-004)

```bash
curl -m 5 http://148.113.203.22:8222/
# Esperado: timeout o conexión rechazada -- nunca una respuesta HTTP.
```

### Paso 3 — Alta de una persona de prueba de punta a punta (cubre AC-005, AC-008)

1. Admin genera un par de llaves de prueba (`ssh-keygen -t ed25519 -f test-key`), autoriza la pública bajo `visiontunnel`, y sube la privada a un item de prueba en Vaultwarden con el nombre exacto `omnia-memory-tunnel-ssh-key` en la cuenta de la persona de prueba.
2. En una máquina Windows real (o VM), correr:
   ```powershell
   .\memory\setup\windows.ps1
   ```
3. Completar el login interactivo con las credenciales de la cuenta de prueba.
4. **Esperado:**
   - `memory\.memory.env` existe con los 6 valores esperados (`OMNIA_MEMORY_MCP_URL`, `OMNIA_MEMORY_GLOBAL_MCP_URL`, `OMNIA_MEMORY_TOKEN`, `OMNIA_MEMORY_SSH_HOST`, `OMNIA_MEMORY_SSH_USER`, `OMNIA_MEMORY_SSH_KEY`).
   - `Get-ScheduledTask -TaskName OmniaMemoryTunnel` devuelve estado `Running`.
   - `netstat -an | findstr 8765` muestra `127.0.0.1:8765` escuchando.

### Paso 4 — Variables de entorno heredadas sin sourcing manual (cubre AC-011)

```powershell
# En una terminal NUEVA, sin haber corrido nada del script en esa sesión:
[Environment]::GetEnvironmentVariable("OMNIA_MEMORY_MCP_URL", "User")
# Esperado: el valor correcto, no vacío.
```

Abrir Claude Code (u otro IDE con `.mcp.json` de este repo) desde cero y confirmar que `omnia-memory`/`omnia-memory-global` conectan sin `INVALID_CONFIG`.

### Paso 5 — Reinicio sobrevive sin intervención (cubre AC-009)

1. Reiniciar la máquina de prueba.
2. Loguearse en Windows (sin correr ningún script).
3. Esperar ~30 segundos. Confirmar `Get-ScheduledTask -TaskName OmniaMemoryTunnel` en `Running` y el puerto `8765` escuchando de nuevo, sin comandos manuales.

### Paso 6 — Idempotencia (cubre AC-010)

1. En la misma máquina ya configurada, correr `memory\setup\windows.ps1` de nuevo.
2. **Esperado:** no pide login a Vaultwarden (detecta la llave local existente), y `Get-ScheduledTask -TaskName OmniaMemoryTunnel` sigue existiendo una sola vez (no aparece una segunda tarea con sufijo).

### Paso 7 — Fallo de login no deja estado a medias (cubre AC-012)

1. Correr el script apuntando a un `-VaultServer` inexistente (ej. `https://vault-no-existe.omniaos.ai`) en una máquina limpia (sin llave previa).
2. **Esperado:** el script falla en el login con mensaje claro; `memory\.memory.env` **no** se crea; `Get-ScheduledTask -TaskName OmniaMemoryTunnel` devuelve "no encontrado".

### Paso 8 — Offboarding revoca acceso real (cubre AC-007)

1. Con la persona de prueba del Paso 3 ya onboardeada, el admin quita su clave pública de `authorized_keys` en `visiontunnel` y la remueve de la organización en Vaultwarden.
2. En la máquina de prueba, forzar una reconexión del túnel (reiniciar la tarea programada o la máquina).
3. **Esperado:** el handshake SSH falla (`Permission denied (publickey)`) — el túnel no logra reconectar con la llave revocada.

### Paso 9 — Servicios existentes sin cambios (cubre AC-013, AC-014)

```bash
git diff --stat -- gateway/docker-compose.yml memory/docker-compose.yml metrics-hub/docker-compose.yml memory/tunnel.sh
# Esperado: sin output -- ninguno de los cuatro archivos cambió.
```

Confirmar además que `https://metrics.omniaos.ai` y `https://gateway.omniaos.ai` (si ya está propagado) responden exactamente igual que antes de desplegar `vault`.

## Helpers y Fixtures

- Cuenta de prueba dedicada en Vaultwarden (no una cuenta real del equipo) para los Pasos 3-8, removible al terminar sin afectar accesos reales.
- Par de llaves SSH de prueba (`test-key`/`test-key.pub`), descartable — nunca reutilizar una llave de prueba como llave real de alguien del equipo.
- Máquina Windows real o VM con Git for Windows instalado, para correr el script sin afectar la laptop de trabajo de nadie durante la validación.

## Comandos de Ejecución

No hay un comando único — cada paso de este plan se ejecuta a mano, en el orden dado. El Paso 3 (alta de punta a punta) es el más largo y depende de que los Pasos 1-2 ya hayan pasado (Vaultwarden desplegado y verificado).

## Resumen de Tests

| Paso | AC(s) cubiertos | Requiere acceso a |
|---|---|---|
| 1 | AC-002, AC-003 | Internet (dominio público) |
| 2 | AC-001, AC-004 | Internet |
| 3 | AC-005, AC-008 | Coolify, VPS (`visiontunnel`), Vaultwarden admin, máquina Windows |
| 4 | AC-011 | Máquina Windows del Paso 3 |
| 5 | AC-009 | Máquina Windows del Paso 3 |
| 6 | AC-010 | Máquina Windows del Paso 3 |
| 7 | AC-012 | Máquina Windows limpia |
| 8 | AC-007 | VPS, Vaultwarden admin, máquina Windows del Paso 3 |
| 9 | AC-013, AC-014 | Repo local + dominios públicos existentes |

AC-006, AC-015 y AC-016 se verifican por inspección directa (permisos del panel de Vaultwarden; lectura de los dos documentos actualizados) más que por comando — no requieren un paso numerado propio.
