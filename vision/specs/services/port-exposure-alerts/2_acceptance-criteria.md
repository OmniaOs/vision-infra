# Criterios de Aceptación: Alertas automáticas de exposición de puertos

## Metadata

```yaml
feature: port-exposure-alerts
version: 1
last_updated: 2026-08-27
```

## Resumen Ejecutivo

Total de criterios: **15**, agrupados en 5 categorías:

1. Detección correcta (AC-001 a AC-004)
2. Alcance y falsos positivos (AC-005 a AC-007)
3. Manejo de errores operacionales (AC-008 a AC-009)
4. Instalación y despliegue en producción (AC-010 a AC-012)
5. Documentación y trazabilidad (AC-013 a AC-015)

Los criterios de la fixture local (AC-002 a AC-007, AC-013 parcial) se verifican con `docker compose` en cualquier máquina de desarrollo, sin tocar `server-omniaplatform` — ver `3_test-plan.md`. Los criterios de producción (AC-001, AC-010 a AC-012, AC-014, AC-015) requieren la corrida real contra el VPS, ejecutada por quien implemente esta spec con acceso a `server-omniaplatform`.

---

## 1. Detección correcta

### AC-001: Estado limpio real en producción se reporta como `OK`

**Given** `check.sh` está instalado y corriendo vía cron en `server-omniaplatform`, y los seis contenedores del allowlist (`litellm`, `db`, `openmemory-mcp`, `mem0_store`, `hermes`, `metrics-hub`) tienen sus puertos publicados solo en `127.0.0.1` (el estado actual confirmado del repo, post-`82cba23`),
**When** el cron dispara una corrida (o se fuerza una manual: `check.sh`),
**Then** el script termina con código de salida `0` y agrega al log una línea `[OK] N contenedor(es) en scope, 0 hallazgos: <nombres>`, con `N` igual a la cantidad real de contenedores en ejecución que matchean el allowlist ese momento.

### AC-002: Estado limpio en la fixture local se reporta como `OK`

**Given** la fixture de prueba (`test/docker-compose.fixture.yml`) está levantada con un contenedor cuyo nombre matchea el allowlist (ej. `litellm-fixture`) publicado en `127.0.0.1:<puerto>`,
**When** se corre `check.sh` apuntando `PORT_EXPOSURE_LOG` a un archivo temporal,
**Then** el código de salida es `0` y el log contiene una línea `[OK]` que incluye `litellm-fixture` en la lista de contenedores en scope, sin ninguna línea `[ALERT]`.

### AC-003: Un binding público en un contenedor del allowlist se detecta como `ALERT`

**Given** la fixture incluye un contenedor cuyo nombre matchea el allowlist (ej. `hermes-fixture`) publicado sin el prefijo `127.0.0.1:` (equivalente a `0.0.0.0:<puerto>`),
**When** se corre `check.sh` contra la fixture,
**Then** el código de salida es `1`, y el log contiene una línea `[ALERT]` que menciona explícitamente `hermes-fixture`, el puerto en formato `<puerto>/tcp`, y `0.0.0.0` como `HostIp` detectado.

### AC-004: Múltiples hallazgos en una sola corrida se reportan todos, no solo el primero

**Given** la fixture tiene dos o más contenedores del allowlist con bindings públicos simultáneamente,
**When** se corre `check.sh`,
**Then** el log contiene una línea `[ALERT]` distinta por cada hallazgo (una por combinación contenedor+puerto), y el código de salida sigue siendo `1` (no cambia por tener más de un hallazgo).

---

## 2. Alcance y falsos positivos

### AC-005: Un contenedor fuera del allowlist con binding público NO genera hallazgo

**Given** la fixture incluye un contenedor cuyo nombre **no** matchea ningún prefijo del allowlist (ej. `coolify-proxy-fixture`, simulando el caso real de `coolify-proxy`/Traefik), publicado en `0.0.0.0:<puerto>` — el binding "peor" de toda la fixture,
**When** se corre `check.sh`,
**Then** el log **no** contiene ninguna mención de `coolify-proxy-fixture`, ni como `[OK]` ni como `[ALERT]` — el contenedor nunca fue inspeccionado, consistente con INV-2 de `1_spec.md` (allowlist, no denylist).

### AC-006: Un puerto `EXPOSE`d sin publicar no genera hallazgo

**Given** un contenedor del allowlist tiene un puerto declarado en su imagen (`EXPOSE`) pero sin ninguna entrada `ports:` correspondiente en la fixture (sin binding de host),
**When** se corre `check.sh`,
**Then** ese puerto específico no aparece en ninguna línea `[ALERT]` — confirma INV-3: la ausencia de `HostIp` no se trata como un `HostIp` distinto de `127.0.0.1`.

### AC-007: El matching de prefijo exige un separador, no un substring libre

**Given** existe (hipotéticamente, en la fixture de prueba) un contenedor nombrado de forma que contiene un prefijo del allowlist como substring pero no como prefijo real (ej. `notdb-something` o `xdb-something`, que contienen `db` pero no empiezan con `db-` ni son exactamente `db`),
**When** se corre `check.sh`,
**Then** ese contenedor no se agrega a la lista de contenedores en scope — el matching usa `"$name" == "$p" || "$name" == "$p-*"` (coincidencia exacta o prefijo seguido de guión), no `*"$p"*` (substring libre en cualquier posición).

---

## 3. Manejo de errores operacionales

### AC-008: Docker inaccesible se reporta como `ERROR`, no como hallazgo ni como limpio

**Given** el comando `docker ps` falla (simulado localmente, ej. apuntando `DOCKER_HOST` a un socket inexistente, o corriendo como un usuario sin permisos sobre el socket de Docker),
**When** se corre `check.sh`,
**Then** el código de salida es `2` (distinto de `0` y de `1`), y el log contiene una línea `[ERROR]` con el detalle del fallo — nunca una línea `[OK]` ni `[ALERT]` en esa corrida.

### AC-009: Cero contenedores en scope se reporta como `WARN`, no como limpio

**Given** ningún contenedor en ejecución coincide con el `PORT_EXPOSURE_PREFIXES` configurado (ej. se corre `check.sh` con `PORT_EXPOSURE_PREFIXES=no-existe-nada` contra la fixture, o contra un Docker local sin ningún contenedor levantado),
**When** se corre `check.sh`,
**Then** el código de salida es `3` (distinto de `0`), y el log contiene una línea `[WARN]` mencionando que 0 contenedores coincidieron — este estado nunca se confunde con "todo limpio" (código `0`) en el log ni en el código de salida.

---

## 4. Instalación y despliegue en producción

### AC-010: El cron job instalado corre solo, sin intervención manual

**Given** la línea de crontab del Algoritmo → Paso 3 de `1_spec.md` fue instalada en el crontab de `root` en `server-omniaplatform`,
**When** transcurre la siguiente hora en punto sin que nadie ejecute el script a mano,
**Then** aparece una nueva línea de log en `/var/log/omnia/port-exposure-check.log` con un timestamp correspondiente a esa ventana horaria, generada exclusivamente por el disparo del cron.

### AC-011: El check no requiere secrets, credenciales ni runtimes nuevos en el VPS

**Given** el estado de `server-omniaplatform` antes de implementar esta feature (Docker Engine + cron del sistema, ambos ya presentes),
**When** se instala y corre `check.sh` según el Algoritmo de `1_spec.md`,
**Then** no se requiere instalar Node, Python, `jq`, ni ningún paquete adicional en el host; no se define ninguna variable de entorno con un secret nuevo en Coolify ni en ningún `.env`; el único requisito no presente de antemano es la ruta de checkout del repo en el VPS (Algoritmo → Paso 0), que no es un secret.

### AC-012: Ningún `docker-compose.yml` de los tres servicios cambia como parte de esta feature

**Given** el repo antes de implementar esta feature,
**When** se compara `gateway/docker-compose.yml`, `memory/docker-compose.yml` y `metrics-hub/docker-compose.yml` antes y después (ej. `git diff` sobre los tres archivos),
**Then** el diff está vacío en los tres — confirma INV-1 de `1_spec.md`: el check es estrictamente de solo lectura sobre la infraestructura existente.

---

## 5. Documentación y trazabilidad

### AC-013: Cada corrida escribe exactamente una entrada de log, sin excepción

**Given** cualquiera de los cuatro estados posibles (`OK`, `ALERT` con N≥1 hallazgos, `ERROR`, `WARN`),
**When** se cuenta cuántas líneas de log nuevas aparecen tras una sola invocación de `check.sh`,
**Then** aparece como mínimo una línea nueva en todos los casos (una por estado, más una línea `[ALERT]` adicional por cada hallazgo individual en el caso de múltiples hallazgos) — nunca cero líneas nuevas tras una corrida completa, confirmando INV-6.

### AC-014: `DEPLOY_COOLIFY.md` documenta el check tras la implementación

**Given** el check está instalado y verificado funcionando en `server-omniaplatform` (AC-001, AC-010),
**When** se lee `DEPLOY_COOLIFY.md`,
**Then** contiene una sub-sección nueva que describe la existencia del check, la ruta del script y del log en el VPS, la cadencia del cron, y menciona explícitamente que no envía notificaciones push todavía (consistente con `0_contract.md` → Alcance → No incluye).

### AC-015: El log es legible sin necesitar una sesión SSH directa

**Given** el archivo `/var/log/omnia/port-exposure-check.log` existe en `server-omniaplatform` con al menos una entrada,
**When** se usa una herramienta genérica de OCC sobre el nodo `server-omniaplatform` (ej. `occ files_download`, o `occ terminal_open` seguido de `cat`/`tail`) para leerlo,
**Then** el contenido se obtiene correctamente sin necesitar credenciales SSH nuevas ni una integración adicional — reutiliza el acceso a OCC que este repo ya usa para otras verificaciones de infraestructura (ver `DEPLOY_COOLIFY.md` → "Verificar estado en vivo").

---

## Cobertura del Contrato

| Sección del contrato (`0_contract.md`) | ACs que la cubren |
|---|---|
| Escenario A (happy path) | AC-001, AC-002 |
| Escenario B (regresión detectada) | AC-003, AC-004 |
| Escenario C (falso positivo evitado — `coolify-proxy`) | AC-005 |
| Escenario D (falla operacional) | AC-008 |
| Escenario E (cero contenedores en scope) | AC-009 |
| Escenario F (`EXPOSE` sin publicar) | AC-006 |
| Alcance → Incluye: allowlist de prefijos | AC-005, AC-007 |
| Alcance → Incluye: cron en `server-omniaplatform` | AC-010 |
| Alcance → Incluye: log de auditoría | AC-013, AC-015 |
| Alcance → Incluye: fixture de prueba local | AC-002 a AC-009 (todas se validan primero en fixture) |
| Alcance → Incluye: actualización de `DEPLOY_COOLIFY.md` | AC-014 |
| Alcance → No incluye: notificaciones push | Implícito en AC-014 (la documentación debe decir explícitamente que no existen todavía) |
| Invariante INV-1 (solo lectura) | AC-012 |
| Invariante INV-2 (allowlist, no denylist) | AC-005 |
| Invariante INV-3 (`EXPOSE` sin publicar no es hallazgo) | AC-006 |
| Invariante INV-5 (sin secrets/runtimes nuevos) | AC-011 |
| Invariante INV-6 (una entrada de log por corrida) | AC-013 |
| Invariante INV-7 (códigos de salida mutuamente excluyentes) | AC-001, AC-003, AC-008, AC-009 |

## Notas

- No hay criterios de "performance" o "carga": el check corre sobre a lo sumo seis contenedores conocidos, con `docker inspect` de costo trivial — no aplica un criterio de tiempo de ejecución.
- AC-005 es, junto con AC-001, el criterio más crítico del set: valida el límite exacto que distingue esta feature de "monitoreo de seguridad de toda la VPS" (fuera de alcance, ver `0_contract.md`). Si `coolify-proxy` alguna vez apareciera en el log de este check, sería señal de que el allowlist se rompió, no de que el check "mejoró".
- La mayoría de los criterios (AC-002 a AC-009, y parte de AC-013) se verifican con la fixture local, sin ningún riesgo sobre `server-omniaplatform` — solo AC-001, AC-010, AC-011, AC-012, AC-014 y AC-015 requieren acceso real al VPS.
- Ningún criterio de este set exige tocar `gateway/docker-compose.yml`, `memory/docker-compose.yml`, `metrics-hub/docker-compose.yml` ni `memory/hermes/*` — si al implementar parece necesario, es señal de que la implementación se desvió del alcance de `0_contract.md`.

## Definición de "Hecho" para esta feature

Esta feature se considera completa (lista para cerrar con `/onspecomplete port-exposure-alerts`) únicamente cuando se cumplen **todas** las siguientes condiciones simultáneamente:

1. Los 15 criterios de aceptación (AC-001 a AC-015) pasan — los de fixture (AC-002 a AC-009, AC-013 parcial) en una ejecución local reproducible, y los de producción (AC-001, AC-010 a AC-012, AC-014, AC-015) contra `server-omniaplatform` real.
2. El cron job demuestra al menos una corrida automática real (AC-010) — no basta con una corrida manual forzada.
3. `DEPLOY_COOLIFY.md` refleja el check (AC-014) sin dejar pendiente ninguna mención a "evaluar un check periódico" en el postmortem asociado (la acción de seguimiento queda cerrada, no solo el código escrito).
4. Ningún `docker-compose.yml` de los tres servicios cambió como efecto secundario (AC-012).

Si alguna de estas condiciones no se cumple, la feature permanece en `in-progress` hasta resolverla. Quien ejecute `/onspecomplete` sobre esta feature debe poder pegar, para AC-001 y AC-010 en particular, el contenido real de las líneas de log correspondientes en `server-omniaplatform` — no una descripción de memoria de "sí corrió".
