# Especificación Técnica: Alertas automáticas de exposición de puertos

## Metadata

```yaml
status: pending
version: 1
last_updated: 2026-08-27
category: services
```

## Historial de Cambios

- [ADDED] 2026-08-27: Versión inicial de la especificación.

## Tipo de Artefacto

Código real: un script de shell + su fixture de prueba, más un paso de despliegue operativo manual (instalar el cron job). A diferencia de las otras dos specs del Sprint 1 (acciones operativas puras sin código), esta sección "Algoritmo" describe funciones y flujo de control reales de `check.sh`, no un runbook de consola. Quien ejecute `/executespec port-exposure-alerts` debe crear el archivo `ops/port-exposure-check/check.sh` con (una versión revisada de) el contenido de este documento, además de ejecutar el paso operativo de instalar el cron en `server-omniaplatform`.

## Invariantes

- **INV-1**: el check nunca modifica `docker-compose.yml` de ningún servicio, ni la configuración de ningún recurso de Coolify, ni el estado de ningún contenedor. Es estrictamente de solo lectura (`docker ps` / `docker inspect`).
- **INV-2**: el scope del check es un **allowlist** de prefijos de nombre de contenedor (`litellm`, `db`, `openmemory-mcp`, `mem0_store`, `hermes`, `metrics-hub`), no un denylist. Un contenedor que no coincide con ningún prefijo del allowlist nunca se inspecciona, sin importar cómo tenga publicados sus puertos — esto es lo que garantiza que `coolify-proxy` (o cualquier futura app no relacionada con este repo en el mismo host) nunca genere una alerta, por construcción, no por una regla de exclusión que alguien tenga que mantener actualizada.
- **INV-3**: un puerto `EXPOSE`d pero no publicado a ningún host (sin entrada en `.NetworkSettings.Ports`, o con lista de bindings vacía/`null` para ese puerto) nunca es un hallazgo. Solo los puertos con un binding de host real y explícito cuentan.
- **INV-4**: el check corre fuera de cualquier contenedor Docker de este repo — directamente en el host de `server-omniaplatform` vía cron del sistema. Ningún `docker-compose.yml` de este repo monta el socket de Docker (`/var/run/docker.sock`) en ningún contenedor como parte de esta feature (ver "Alternativas Consideradas", opción 1, sobre por qué se evita deliberadamente).
- **INV-5**: el script no requiere ningún secret ni credencial nueva. Su única dependencia de entorno es el propio Docker Engine del host (acceso al socket de Docker, ya requerido por Coolify) y un directorio de log escribible.
- **INV-6**: cada corrida del check escribe **exactamente una entrada de log**, sea cual sea el resultado (`OK`, `ALERT` uno o más, `ERROR`, o `WARN`) — nunca corre en silencio. Un log vacío para una ventana de tiempo dada significa "el cron no corrió", no "todo estaba limpio".
- **INV-7**: los códigos de salida son estables y mutuamente excluyentes: `0` (limpio), `1` (≥1 hallazgo), `2` (error operacional, el check no pudo completar la inspección), `3` (cero contenedores en scope). Ningún otro código de salida es válido.
- **INV-8**: el script es idempotente y sin efectos colaterales entre corridas — ejecutarlo dos veces seguidas produce el mismo resultado (salvo que el estado real de los contenedores haya cambiado entre medio) y no acumula estado propio más allá de las líneas que agrega al log.

## Stack Técnico

- **Lenguaje**: bash (POSIX-ish, con extensiones de Bash — arrays, `[[`). **No Node**, pese a que el resto del repo es mayoritariamente Node/Python. Justificación completa en "Alternativas Consideradas" — en resumen: el script corre en el host desnudo del VPS, donde Node no está confirmado instalado (solo corre dentro de los contenedores que cada servicio construye vía su propio Dockerfile); bash + `docker` CLI ya están garantizados presentes porque el propio Docker Engine los necesita para funcionar.
- **Dependencias externas**: ninguna más allá de `bash`, `docker` (CLI) y utilidades estándar de coreutils (`date`, `mkdir`, `mktemp`). Sin `jq` — el parseo de `docker inspect` se hace enteramente con el motor de templates Go que `docker inspect --format` ya expone, evitando una dependencia externa que no está garantizada en una instalación base de Ubuntu.
- **Scheduler**: `cron` del sistema (paquete `cron` de Ubuntu/Debian), confirmado `running`/`enabled` en `server-omniaplatform` — no se introduce ningún scheduler nuevo.
- **Testing local**: `docker compose` (el plugin, ya requerido para levantar cualquier stack de este repo localmente) contra una fixture desechable — ver `3_test-plan.md`.

## Alternativas Consideradas

Documentado para que quien retome esta spec entienda por qué se descartaron las otras dos ubicaciones candidatas mencionadas explícitamente en el postmortem y en el contexto de esta tarea:

1. **Cron dentro del contenedor `hermes`** (reutilizar el daemon Node que ya corre en loop vía `HERMES_INTERVAL`, ver `memory/hermes/index.mjs` y `memory/docker-compose.yml`). Es la opción que el propio postmortem sugiere primero ("podría vivir en Hermes"). Descartada tras leer el `docker-compose.yml` real de `memory/`: `hermes` no monta `/var/run/docker.sock` ni tiene el CLI de Docker instalado en su imagen (`memory/hermes/Dockerfile`) — no tiene ninguna vía para ver el estado de Docker del host tal como está hoy. Para que funcionara habría que:
   - Montar el socket de Docker del host dentro del contenedor `hermes`. Esto es un problema de seguridad más grave que el que esta feature busca prevenir: un contenedor con `/var/run/docker.sock` montado tiene, en la práctica, control total sobre el host (puede crear contenedores privilegiados, leer cualquier volumen, etc.). Dado que `hermes` ya maneja tokens de GitHub con permisos de escritura (`HERMES_PROPOSALS_TOKEN`) y llama a un LLM externo con inputs semi-controlados (commits/handoffs de varios repos), ampliar su superficie de ataque con acceso al socket de Docker sería cambiar un riesgo de exposición de puertos por un riesgo de compromiso total del host — un mal trade incluso si nunca se explota.
   - O instalar el CLI de Docker + dar de algún otro modo acceso al daemon del host — variante del mismo problema.
   - Además, mezclaría conceptualmente un daemon de "self-learning con gate humano" (propone lecciones, nunca actúa solo) con un control de seguridad que debe fallar ruidosamente (exit code distinto de cero) — semánticas de fallo distintas en el mismo proceso.
2. **Cron simple en el VPS** (elegida). Reutiliza el servicio `cron` de systemd que ya está `running`/`enabled` en `server-omniaplatform` (confirmado vía `occ services_list` al escribir esta spec) — cero infraestructura nueva, cero contenedores nuevos, cero cambios a ningún `docker-compose.yml` existente. El script corre con los mismos privilegios que ya se asumen para cualquier operación de mantenimiento del VPS (acceso de `root`), sin necesitar montar el socket de Docker en nada.
3. **OCC** (`nodes_get` / `services_list` / `processes_list`, el MCP usado para verificar infraestructura de producción en `DEPLOY_COOLIFY.md` y en esta misma spec). Explícitamente evaluada y descartada como mecanismo de implementación, aunque sí se usó como herramienta de verificación puntual al escribir esta spec (confirmar que `cron` está `running`). Razones del descarte:
   - OCC es un producto de soporte remoto multi-tenant (Omnia Control Center), separado de `vision-infra`. Construir la lógica de este check *dentro* de OCC significaría escribir código en un repo/producto distinto, con su propio ciclo de release, para resolver un problema específico de este repo — capas equivocadas.
   - Las herramientas actuales de OCC no dan lo que este check necesita de forma nativa: `services_list` enumera servicios `systemd`, no bindings de puertos de contenedores Docker; `processes_list` enumera procesos del SO, no `NetworkSettings.Ports`. Habría que construir soporte nuevo en OCC solo para este caso de uso — de nuevo, capa equivocada para un check específico de este repo.
   - Sin automatización, "usar OCC" degradaría a "un humano corre `services_list`/`processes_list` de vez en cuando y mira" — exactamente la falta de alerta automática que el postmortem señala como el gap a cerrar, no una solución a él.
   - Uso legítimo de OCC que **sí** queda como parte de esta feature: sus herramientas genéricas de archivos/terminal (`occ files_download`, `occ terminal_open`) sirven para que un operador lea el log del check sin necesitar SSH directo — eso no es "OCC corriendo el check", es "OCC como método de acceso al VPS que ya se usa para todo lo demás en este repo".
4. **GitHub Action / CI externo.** Descartado de raíz: la política post-incidente hace que los puertos de los tres servicios sean inalcanzables desde fuera del VPS por diseño (`127.0.0.1`-only + `omnia-portblock`) — un runner externo no podría inspeccionar el binding real sin abrir exactamente el agujero que esta feature busca detectar, o sin un túnel SSH persistente que este repo no tiene configurado como infraestructura.

## Modelo de Datos

No hay entidades de aplicación. El "modelo" relevante es el formato de la línea de log que cada corrida produce:

```
<timestamp ISO 8601 UTC> [<STATUS>] <mensaje legible>
```

Donde `<STATUS>` es uno de `OK`, `ALERT`, `ERROR`, `WARN` (ver Manejo de Errores). Ejemplo de un archivo de log tras varias corridas:

```
2026-08-27T03:00:01Z [OK] 6 contenedor(es) en scope, 0 hallazgos: litellm-abc123 db-abc123 openmemory-mcp-def456 mem0_store-def456 hermes-def456 metrics-hub-ghi789
2026-08-27T04:00:01Z [OK] 6 contenedor(es) en scope, 0 hallazgos: litellm-abc123 db-abc123 openmemory-mcp-def456 mem0_store-def456 hermes-def456 metrics-hub-ghi789
2026-08-27T05:00:02Z [ALERT] hermes-def456 puerto 8080/tcp publicado en 0.0.0.0:8080 (esperado: 127.0.0.1)
```

Formato elegido por ser `grep`-able (`grep ALERT`, `grep -c OK`) sin depender de un parser JSON para el caso de uso más común (revisión manual rápida). No se descarta agregar una variante JSON-lines en una iteración futura si algo empieza a consumir el log programáticamente — no hace falta hoy, ningún consumidor automatizado existe todavía (ver Alcance → No incluye: notificaciones push).

## Algoritmo

### Paso 0 — Prerrequisitos (una vez, al desplegar esta feature)

1. Checkout de `vision-infra` en una ruta fija de `server-omniaplatform`, dedicada a scripts de operación y separada de los directorios de build que gestiona Coolify por recurso (ej. `/opt/omnia/vision-infra-ops`). No hace falta el repo completo funcionalmente, pero clonarlo entero es más simple que sincronizar un solo archivo y mantiene `check.sh` versionado igual que el resto del repo.
2. Confirmar `docker --version` y que el usuario que instalará el cron (`root`) puede correr `docker ps` sin `sudo` adicional.
3. `mkdir -p /var/log/omnia` (el propio script lo hace también de forma idempotente, pero conviene confirmarlo antes del primer run).

### Paso 1 — El script (`ops/port-exposure-check/check.sh`)

```bash
#!/usr/bin/env bash
# ops/port-exposure-check/check.sh
#
# Alerta si algún contenedor de vision-infra (litellm, db, openmemory-mcp,
# mem0_store, hermes, metrics-hub) tiene un puerto publicado fuera de
# 127.0.0.1. Formaliza la acción de seguimiento del postmortem del
# 20-jul-2026 (docs/postmortems/2026-07-20-openmemory-ui-rce.md).
#
# Solo detecta + loguea + sale con código distinto por estado — no envía
# notificaciones (no hay canal configurado en este repo). Diseñado para
# correr como cron job en el host del VPS, NO dentro de un contenedor
# (evita montar el socket de Docker en ningún servicio de este repo).
#
# Códigos de salida: 0=limpio 1=hallazgo(s) 2=error-operacional 3=sin-scope
set -euo pipefail

PREFIXES="${PORT_EXPOSURE_PREFIXES:-litellm,db,openmemory-mcp,mem0_store,hermes,metrics-hub}"
LOG_FILE="${PORT_EXPOSURE_LOG:-/var/log/omnia/port-exposure-check.log}"

mkdir -p "$(dirname "$LOG_FILE")"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(ts) [$1] $2" >> "$LOG_FILE"; }

# --- Paso 1: ¿Docker responde? ---
names_file="$(mktemp)"
err_file="$(mktemp)"
trap 'rm -f "$names_file" "$err_file"' EXIT

if ! docker ps --format '{{.Names}}' > "$names_file" 2> "$err_file"; then
  log ERROR "docker ps falló: $(tr '\n' ' ' < "$err_file")"
  exit 2
fi

# --- Paso 2: filtrar por allowlist de prefijos ---
IFS=',' read -ra PREFIX_ARR <<< "$PREFIXES"
matched=()
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  for p in "${PREFIX_ARR[@]}"; do
    if [[ "$name" == "$p" || "$name" == "$p"-* ]]; then
      matched+=("$name")
      break
    fi
  done
done < "$names_file"

if [[ "${#matched[@]}" -eq 0 ]]; then
  log WARN "0 contenedores coincidieron con el allowlist ($PREFIXES) -- verificar si los servicios estan caidos o el allowlist desactualizado"
  exit 3
fi

# --- Paso 3: inspeccionar bindings de cada contenedor en scope ---
findings=()
for name in "${matched[@]}"; do
  while IFS='|' read -r port hostip hostport; do
    [[ -z "$port" ]] && continue
    if [[ "$hostip" != "127.0.0.1" ]]; then
      findings+=("$name|$port|$hostip|$hostport")
    fi
  done < <(docker inspect --format \
    '{{range $port, $bindings := .NetworkSettings.Ports}}{{range $bindings}}{{$port}}|{{.HostIp}}|{{.HostPort}}
{{end}}{{end}}' "$name" 2>> "$err_file" || true)
done

# --- Paso 4: reportar ---
if [[ "${#findings[@]}" -eq 0 ]]; then
  log OK "${#matched[@]} contenedor(es) en scope, 0 hallazgos: ${matched[*]}"
  exit 0
fi

for f in "${findings[@]}"; do
  IFS='|' read -r name port hostip hostport <<< "$f"
  log ALERT "$name puerto $port publicado en $hostip:$hostport (esperado: 127.0.0.1)"
done
exit 1
```

Notas de implementación sobre el script:

- El template Go de `docker inspect --format` itera `.NetworkSettings.Ports` (un mapa `"puerto/proto" → [{HostIp, HostPort}, ...] | null`). Cuando el valor es `null` (puerto `EXPOSE`d sin publicar) el `range` interno simplemente no itera — cero líneas de salida para ese puerto, cero hallazgos. Esto es lo que garantiza INV-3 sin necesitar un `if` explícito para ese caso.
- `set -euo pipefail` + el manejo explícito de errores en el Paso 1 asegura que un fallo de `docker ps` (daemon caído, sin permisos) termine en el código `2`, no en un crash silencioso de bash o un `exit` con código genérico `1` (que se reserva exclusivamente para hallazgos reales — ver INV-7).
- El matching de prefijo (`"$name" == "$p" || "$name" == "$p"-*`) exige un separador `-` tras el prefijo (o coincidencia exacta), no un `substring` libre — evita que, por ejemplo, un futuro contenedor `dbadmin-tool` (sin guión) colisione accidentalmente con el prefijo `db`. El caso ya conocido y documentado de colisión posible (`db-` con la Postgres de otra app futura) queda anotado como límite conocido en `0_contract.md`, no resuelto por este matching.

### Paso 2 — La fixture de prueba local

Ver `3_test-plan.md` para el contenido completo de `docker-compose.fixture.yml` y `run-fixture-test.sh`. Se corre en cualquier máquina con Docker (no en el VPS) antes de instalar el cron, para validar el detector sin ningún riesgo sobre producción.

### Paso 3 — Instalar el cron job en `server-omniaplatform`

```bash
# Como root en server-omniaplatform, tras el checkout del Paso 0:
crontab -l 2>/dev/null > /tmp/crontab.bak || true
cat <<'EOF' >> /tmp/crontab.bak
# Omnia: check de exposicion de puertos (vision-infra, port-exposure-alerts)
0 * * * * PORT_EXPOSURE_LOG=/var/log/omnia/port-exposure-check.log /opt/omnia/vision-infra-ops/ops/port-exposure-check/check.sh
EOF
crontab /tmp/crontab.bak
crontab -l   # confirmar que la línea quedó instalada
```

Cadencia elegida: cada hora (`0 * * * *`). Es un balance deliberado: mucho más frecuente que los ~4 días que tardó en notarse la exposición real del incidente, sin ser tan agresivo como para generar ruido en el log en un check que es barato de correr (`docker inspect` sobre 6 contenedores es del orden de milisegundos). Si en el futuro se agrega una notificación push real (fuera del alcance de esta spec), la cadencia puede revisarse hacia algo más frecuente sin cambiar el script.

### Paso 4 — Verificación post-instalación

1. Forzar una corrida manual: `sudo -u root /opt/omnia/vision-infra-ops/ops/port-exposure-check/check.sh; echo "exit: $?"`.
2. Confirmar `exit: 0` y una línea `OK` nueva en `/var/log/omnia/port-exposure-check.log` (vía SSH, o vía `occ files_download`/`occ terminal_open` sobre `server-omniaplatform`).
3. Esperar a la siguiente hora en punto y confirmar que el cron corrió solo (nueva línea de log sin intervención manual).

### Paso 5 — Documentar en `DEPLOY_COOLIFY.md`

Agregar una sub-sección (ubicación sugerida: después de "Política de seguridad (post-incidente 20-jul-2026)") describiendo: que el check existe, la ruta del script en el VPS, la ruta del log, la cadencia del cron, y que no envía notificaciones push todavía.

## Manejo de Errores

| Código de salida | Escenario | Línea de log | Acción del operador |
|---|---|---|---|
| `0` | Todos los contenedores del allowlist tienen bindings solo-loopback (o sin publicar) | `[OK] N contenedor(es) en scope, 0 hallazgos: <nombres>` | Ninguna — estado esperado. |
| `1` | ≥1 contenedor del allowlist tiene un binding a un `HostIp` distinto de `127.0.0.1` | `[ALERT] <contenedor> puerto <puerto> publicado en <hostIp>:<hostPort> (esperado: 127.0.0.1)` — una línea por hallazgo | Revisar por qué cambió el binding (comparar contra el `docker-compose.yml` del servicio correspondiente vía `git log`/`git diff`, y contra la config del recurso en Coolify). Si es intencional, actualizar esta spec y el allowlist; si no, revertir el binding y tratarlo como incidente de seguridad. |
| `2` | `docker ps` o `docker inspect` fallan (daemon caído, permisos insuficientes) | `[ERROR] docker ps falló: <detalle>` | Verificar `systemctl status docker` y que el usuario del cron tiene acceso al socket de Docker. Este código NO implica que haya un puerto expuesto — implica que el check no pudo verificarlo. |
| `3` | 0 contenedores en ejecución coinciden con el allowlist configurado | `[WARN] 0 contenedores coincidieron con el allowlist (<prefixes>)` | Verificar si los tres servicios están caídos (`docker ps` manual) o si Coolify cambió el patrón de nombres de contenedor y el allowlist quedó desactualizado. Nunca interpretar este código como "todo limpio". |
| N/A (no es un código de salida) | Un puerto está `EXPOSE`d pero sin publicar (sin `HostIp`) | No genera línea de log — no es un hallazgo (INV-3) | Ninguna — comportamiento esperado, no un caso a corregir. |

## Resumen Ejecutivo

Checklist de implementación (a ejecutar por quien corra `/executespec port-exposure-alerts`):

- [ ] Crear `ops/port-exposure-check/check.sh` con el contenido de la sección "Algoritmo → Paso 1" (o una revisión suya, si al implementar aparece algún ajuste necesario — documentarlo en `1_spec.md` con `[CHANGED]`).
- [ ] Crear `ops/port-exposure-check/README.md`, `ops/port-exposure-check/test/docker-compose.fixture.yml` y `ops/port-exposure-check/test/run-fixture-test.sh` según `3_test-plan.md`.
- [ ] Correr la fixture de prueba localmente (Docker en la máquina del ejecutor, no en el VPS) y confirmar los 3 casos (limpio / hallazgo / fuera de scope) antes de tocar producción.
- [ ] Checkout de `vision-infra` en `server-omniaplatform` (ruta dedicada, ver Algoritmo → Paso 0).
- [ ] Instalar el cron job en el crontab de `root` (Algoritmo → Paso 3).
- [ ] Forzar una corrida manual y confirmar `exit 0` + línea `OK` en el log (Algoritmo → Paso 4).
- [ ] Confirmar que el cron corre solo en su siguiente ventana horaria.
- [ ] Actualizar `DEPLOY_COOLIFY.md` (Algoritmo → Paso 5).
- [ ] Correr `/onspecomplete port-exposure-alerts` una vez validado todo lo anterior.

Nota final: dado que esta feature sí produce código real, la definición de "hecho" no se conforma con "el script existe" — requiere la corrida real contra `server-omniaplatform` (Paso 4) con evidencia pegable (el log real), igual que exige `2_acceptance-criteria.md`.
