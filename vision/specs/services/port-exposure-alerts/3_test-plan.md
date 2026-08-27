# Plan de Testing: Alertas automáticas de exposición de puertos

## Metadata

```yaml
test_framework: fixture de docker-compose + asserts en bash (sin runner de terceros)
version: 1
last_updated: 2026-08-27
```

## Estrategia de Testing

A diferencia de las otras dos specs del Sprint 1 (validación enteramente manual, sin artefacto de código), esta feature produce un script real (`check.sh`) que sí se puede probar de forma reproducible y automática — pero el repo no tiene ningún framework de test instalado (`Testing: ninguno configurado todavía`, constitution; ni `memory/hermes/package.json` ni `metrics-hub/package.json` traen `vitest`/`jest`/similar). Sería una ficción cablear aquí un runner de test que no existe en el repo y que nada más ejecutaría.

En su lugar, el test se estructura como **una fixture de `docker-compose` desechable + un script de asserts en bash** (`run-fixture-test.sh`), que cualquier persona con Docker local puede correr sin tocar `server-omniaplatform`. Esto sigue el mismo espíritu que `guardrails/git-hooks/pre-push-scan.mjs` (un script que valida comportamiento corriendo comandos reales, no una suite de test de un framework) — es el patrón más cercano que ya existe en este repo para "código que se verifica solo".

Además de la fixture local, esta spec requiere una **verificación en producción** (contra `server-omniaplatform` real) para los criterios que dependen del cron y del despliegue real — la fixture no puede sustituir eso, solo reducir el riesgo de instalar un script con bugs en producción antes de probarlo.

## Tests de Integración (fixture local)

### Fixture: `ops/port-exposure-check/test/docker-compose.fixture.yml`

```yaml
# Fixture SOLO para pruebas locales de check.sh. Nunca desplegar en el VPS.
# Los tres contenedores no sirven tráfico real -- solo existen para que
# `docker inspect` reporte bindings de puerto reales que check.sh pueda leer.
services:
  litellm-fixture:
    image: alpine:3.20
    command: ["sleep", "infinity"]
    ports:
      - "127.0.0.1:19999:80"   # matchea el allowlist (prefijo "litellm"), loopback -> limpio

  hermes-fixture:
    image: alpine:3.20
    command: ["sleep", "infinity"]
    ports:
      - "19998:80"              # matchea el allowlist (prefijo "hermes"), sin 127.0.0.1: -> hallazgo esperado

  coolify-proxy-fixture:
    image: alpine:3.20
    command: ["sleep", "infinity"]
    ports:
      - "19997:80"              # NO matchea ningun prefijo del allowlist, publico -> debe ignorarse
```

### Script: `ops/port-exposure-check/test/run-fixture-test.sh`

```bash
#!/usr/bin/env bash
# Levanta la fixture, corre check.sh contra el Docker LOCAL de quien ejecuta
# este script (nunca contra server-omniaplatform), valida los 3 casos, y
# limpia. Salida 0 = todos los asserts pasaron.
set -euo pipefail
cd "$(dirname "$0")"

cleanup() { docker compose -f docker-compose.fixture.yml down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Levantando fixture..."
docker compose -f docker-compose.fixture.yml up -d

# Dar un instante a que los contenedores queden Running antes de inspeccionar.
sleep 1

export PORT_EXPOSURE_LOG
PORT_EXPOSURE_LOG="$(mktemp)"

set +e
../check.sh
code=$?
set -e

echo "--- log de la corrida ---"
cat "$PORT_EXPOSURE_LOG"
echo "--- codigo de salida: $code ---"

fail=0
assert() {
  # $1 = descripcion, $2 = condicion (0 = pasa)
  if [[ "$2" -ne 0 ]]; then
    echo "FAIL: $1"
    fail=1
  else
    echo "PASS: $1"
  fi
}

[[ "$code" -eq 1 ]]; assert "exit code es 1 (hay un binding publico en el allowlist: hermes-fixture)" "$?"
grep -q "hermes-fixture" "$PORT_EXPOSURE_LOG"; assert "hermes-fixture aparece como hallazgo" "$?"
! grep -q "coolify-proxy-fixture" "$PORT_EXPOSURE_LOG"; assert "coolify-proxy-fixture NUNCA aparece (fuera del allowlist)" "$?"
! grep -qE "litellm-fixture.*ALERT|ALERT.*litellm-fixture" "$PORT_EXPOSURE_LOG"; assert "litellm-fixture no genera ALERT (esta en loopback)" "$?"
grep -q "\[ALERT\]" "$PORT_EXPOSURE_LOG"; assert "existe al menos una linea [ALERT]" "$?"

if [[ "$fail" -eq 1 ]]; then
  echo "RESULTADO: FALLÓ al menos un assert."
  exit 1
fi
echo "RESULTADO: todos los asserts pasaron."
```

### Caso de test 1 — Detección limpia (cubre AC-002)

Variante del script anterior con solo `litellm-fixture` levantado (comentar o quitar temporalmente los otros dos servicios de la fixture, o levantar selectivamente con `docker compose up -d litellm-fixture`).

**Esperado:** `check.sh` termina con código `0`; el log contiene una línea `[OK]` mencionando `litellm-fixture`; no hay ninguna línea `[ALERT]`.

```bash
docker compose -f docker-compose.fixture.yml up -d litellm-fixture
PORT_EXPOSURE_LOG="$(mktemp)" ../check.sh; echo "exit: $?"
```

### Caso de test 2 — Hallazgo + falso positivo evitado simultáneamente (cubre AC-003, AC-004, AC-005)

Es exactamente lo que corre `run-fixture-test.sh` con los tres servicios levantados: un contenedor limpio (`litellm-fixture`), uno con hallazgo (`hermes-fixture`), y uno fuera de scope con el peor binding posible (`coolify-proxy-fixture`, público). Un solo run de la fixture completa cubre tres ACs a la vez porque son, precisamente, tres comportamientos que deben coexistir en la misma corrida sin interferirse.

### Caso de test 3 — `EXPOSE` sin publicar no es hallazgo (cubre AC-006)

```bash
# Contenedor del allowlist con un puerto interno sin publicar a ningún host.
docker run -d --name metrics-hub-fixture-noport --rm alpine:3.20 sleep infinity
PORT_EXPOSURE_LOG="$(mktemp)" ../check.sh; echo "exit: $?"
# Limpieza:
docker rm -f metrics-hub-fixture-noport
```

**Esperado:** código `0` (o el que corresponda según qué más esté corriendo), y ninguna línea `[ALERT]` que mencione `metrics-hub-fixture-noport` — el contenedor está en scope (matchea el prefijo `metrics-hub`) pero no tiene ningún puerto publicado, así que no genera hallazgo.

### Caso de test 4 — Docker inaccesible se reporta como `ERROR` (cubre AC-008)

```bash
# Simular un docker inaccesible apuntando a un socket que no existe.
DOCKER_HOST="unix:///tmp/no-existe.sock" PORT_EXPOSURE_LOG="$(mktemp)" ../check.sh; echo "exit: $?"
```

**Esperado:** código `2`, y el log temporal contiene una línea `[ERROR]` con el detalle del fallo de `docker ps`.

### Caso de test 5 — Cero contenedores en scope se reporta como `WARN` (cubre AC-009)

```bash
docker compose -f docker-compose.fixture.yml down -v --remove-orphans   # nada levantado
PORT_EXPOSURE_PREFIXES="prefijo-que-no-existe" PORT_EXPOSURE_LOG="$(mktemp)" ../check.sh; echo "exit: $?"
```

**Esperado:** código `3`, y el log contiene una línea `[WARN]` mencionando `0 contenedores coincidieron`.

### Caso de test 6 — Matching de prefijo exige separador (cubre AC-007)

```bash
docker run -d --name dbadmin-tool-fixture --rm alpine:3.20 sleep infinity   # contiene "db" pero no empieza con "db-"
PORT_EXPOSURE_LOG="$(mktemp)" ../check.sh
grep -q "dbadmin-tool-fixture" "$PORT_EXPOSURE_LOG" && echo "FAIL: no debería matchear" || echo "PASS: no matcheó"
docker rm -f dbadmin-tool-fixture
```

## Validación Manual (contra `server-omniaplatform` real)

Estos pasos no tienen equivalente automatizable sin tocar producción — se ejecutan una vez, al implementar la feature, y cada vez que se modifique `check.sh` de forma sustancial.

### Paso 1 — Corrida manual forzada en el VPS (cubre AC-001)

```bash
ssh <user>@148.113.203.22
sudo /opt/omnia/vision-infra-ops/ops/port-exposure-check/check.sh; echo "exit: $?"
tail -5 /var/log/omnia/port-exposure-check.log
```

**Esperado:** `exit: 0`, y la última línea del log es `[OK] 6 contenedor(es) en scope, 0 hallazgos: ...` con los seis contenedores reales de producción.

Alternativa sin SSH directo: `occ terminal_open` sobre `server-omniaplatform`, mismo comando.

### Paso 2 — Corrida automática del cron (cubre AC-010)

Instalar el cron (Algoritmo → Paso 3 de `1_spec.md`), esperar a la siguiente hora en punto, y confirmar una línea de log nueva sin haber corrido nada a mano en el ínterin.

```bash
date -u   # anotar la hora antes de esperar
# ... esperar a la siguiente hora en punto ...
tail -3 /var/log/omnia/port-exposure-check.log
```

**Esperado:** una línea nueva con timestamp posterior al anotado, generada sin intervención manual.

### Paso 3 — Confirmar ausencia de cambios en los tres `docker-compose.yml` (cubre AC-012)

```bash
git diff -- gateway/docker-compose.yml memory/docker-compose.yml metrics-hub/docker-compose.yml
```

**Esperado:** salida vacía.

### Paso 4 — Confirmar que el log es legible vía OCC sin SSH (cubre AC-015)

Usar `occ files_download` (o `occ terminal_open` + `cat`) sobre el nodo `server-omniaplatform` para leer `/var/log/omnia/port-exposure-check.log`, sin abrir una sesión SSH directa.

**Esperado:** el contenido del log se obtiene correctamente por esa vía.

### Paso 5 — Inspección manual de `DEPLOY_COOLIFY.md` (cubre AC-014)

Abrir `DEPLOY_COOLIFY.md`, confirmar que la nueva sub-sección describe el check, su ruta, su log y su cadencia, y menciona explícitamente que no hay notificaciones push todavía.

## Helpers y Fixtures

- `ops/port-exposure-check/test/docker-compose.fixture.yml` — los tres contenedores desechables descritos arriba. Usa `alpine:3.20` (imagen mínima, ya presente en casi cualquier caché local de Docker) con `sleep infinity` como comando — no hace falta que el contenedor sirva tráfico real, `docker inspect` reporta el binding de puerto independientemente de si algo escucha adentro.
- `ops/port-exposure-check/test/run-fixture-test.sh` — orquesta el caso de test 2 (el más representativo, cubre 3 ACs a la vez) de punta a punta, con limpieza automática vía `trap`.
- Ningún caso de test requiere credenciales, tokens ni acceso a servicios externos — todo corre contra el daemon de Docker local de quien ejecuta las pruebas.

## Comandos de Ejecución

```bash
# Suite local completa (caso de test 2, el más representativo):
cd ops/port-exposure-check/test
./run-fixture-test.sh

# Casos de test individuales (1, 3, 4, 5, 6): copiar los comandos de la
# sección correspondiente arriba; no están cableados a un único comando
# porque cada uno requiere un estado de Docker local distinto (fixture
# completa vs. parcial vs. vacía vs. DOCKER_HOST inválido).
```

No hay un `npm test` único porque no hay `package.json` en `ops/` (el script es standalone, sin dependencias de Node) — es deliberado, ver "Stack Técnico" en `1_spec.md`.

## Resumen de Tests

| # | Cubre | Tipo | Toca producción |
|---|---|---|---|
| Caso 1 | AC-002 | fixture local | No |
| Caso 2 (`run-fixture-test.sh`) | AC-003, AC-004, AC-005 | fixture local | No |
| Caso 3 | AC-006 | contenedor local ad-hoc | No |
| Caso 4 | AC-008 | `DOCKER_HOST` inválido local | No |
| Caso 5 | AC-009 | Docker local vacío | No |
| Caso 6 | AC-007 | contenedor local ad-hoc | No |
| Validación manual Paso 1 | AC-001 | corrida real en VPS | Sí (solo lectura) |
| Validación manual Paso 2 | AC-010 | cron real en VPS | Sí (solo lectura) |
| Validación manual Paso 3 | AC-012 | `git diff` | No |
| Validación manual Paso 4 | AC-015 | OCC sobre el VPS | Sí (solo lectura) |
| Validación manual Paso 5 | AC-014 | inspección manual | No |

Total: 6 casos de test automatizables localmente (cubriendo 10 de los 15 ACs) + 5 pasos de validación manual contra producción (cubriendo los 5 ACs restantes: AC-001, AC-010, AC-012, AC-014, AC-015; nótese que AC-011 y AC-013 se validan por inspección directa del script/log durante los pasos anteriores, no como un paso aislado). La feature se considera lista para `/onspecomplete` solo cuando los 6 casos locales pasan **antes** de instalar nada en `server-omniaplatform`, y los 5 pasos manuales pasan **después** de instalarlo — nunca al revés, dado que el propósito de la fixture es reducir el riesgo de correr un script con bugs contra producción.
