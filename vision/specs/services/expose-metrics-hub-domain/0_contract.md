# Feature: Exponer dominio autenticado para metrics-hub

## Metadata

```yaml
status: done
created: 2026-08-26
updated: 2026-08-28
dependencies: none
position: 1
plane_workitem_id: null
```

> **Nota (2026-08-26, vía `/modifyspec`):** esta versión del contrato refleja un descubrimiento posterior a la escritura inicial — esta instalación de Coolify no tiene UI de labels para recursos Docker Compose, así que `metrics-hub/docker-compose.yml` sí cambia como parte de esta feature. Ver `1_spec.md` → Historial de Cambios para el detalle completo.

## User Stories

**Como** Daniel (PM / dueño entrante de vision-infra) **Quiero** poder abrir el leaderboard de `metrics-hub` desde una URL fija y autenticada **Para** revisar el ranking de commits/tokens del equipo sin tener que abrir un túnel SSH manual cada vez.

**Como** responsable de seguridad de `vision-infra` **Quiero** que `metrics-hub` siga sin quedar expuesto sin autenticación a internet **Para** no repetir el vector del incidente del 20-jul-2026 (RCE sin auth en `openmemory-ui`, ver [postmortem](../../../../docs/postmortems/2026-07-20-openmemory-ui-rce.md)) en otro de los tres servicios del repo.

**Como** cualquier miembro del equipo con las credenciales asignadas **Quiero** entrar al dashboard desde el navegador con usuario/contraseña **Para** no depender de tener acceso SSH al VPS ni de instalar nada localmente.

## Naturaleza del Artefacto

Esta feature **no es código de aplicación**, pero sí incluye un cambio de código acotado y deliberado. Es principalmente una acción operativa de infraestructura ejecutada a mano en la consola web de Coolify (dueño: Daniel, quien ya tiene acceso), más una edición puntual de `metrics-hub/docker-compose.yml` (dos labels de Traefik) y de documentación (`DEPLOY_COOLIFY.md`). No hay cambios a la lógica de aplicación de `metrics-hub` — `scripts/`, `dashboard/` y `Dockerfile` no se tocan.

Por esto, `1_spec.md` describe pasos de consola y bloques de configuración (labels de Traefik), no interfaces de programación; y `3_test-plan.md` es validación manual (curl + navegador), no una suite automatizada — el repo no tiene harness de test para config de infraestructura de Coolify.

## Propósito

Desde el fix de seguridad del commit `82cba23` (24-jul-2026, post-incidente del 20-jul-2026), los tres servicios de este repo publican sus puertos Docker solo en `127.0.0.1` del VPS — nada es alcanzable desde internet salvo por túnel SSH. Esa política fue correcta para `gateway` y `memory` (que tienen auth propia o están desactivados por defecto), pero dejó a `metrics-hub` — el único dashboard de este repo que un PM/equipo quiere revisar seguido — sin ninguna vía cómoda de acceso: hoy requiere `ssh -L 4320:127.0.0.1:4320 <user>@148.113.203.22` cada vez.

`metrics-hub` (puerto 4320, ver `metrics-hub/docker-compose.yml`) es un dashboard estático servido por `scripts/serve.mjs` **sin ninguna autenticación incorporada** (confirmado leyendo `docker-entrypoint.sh` y `dashboard/index.html`: no hay lógica de login, sesión ni verificación de credenciales en el código). Por eso no se puede simplemente quitarle el binding a loopback y publicarlo a `0.0.0.0` — sería repetir exactamente el error que causó el incidente del 20-jul-2026.

La solución de esta feature es agregar un dominio Coolify a `metrics-hub` protegido con Traefik BasicAuth: el dominio se agrega desde la consola de Coolify, y el middleware BasicAuth se declara como labels directamente en `metrics-hub/docker-compose.yml` (no hay una pestaña de labels en la UI de Coolify para recursos tipo Docker Compose en esta instalación — confirmado). Esto funciona porque el proxy Traefik de Coolify (`coolify-proxy`) alcanza los contenedores por la red interna de Docker (container-to-container), no a través del puerto publicado al host — el binding a `127.0.0.1:4320` es irrelevante para ese camino de tráfico.

## Escenarios

**A — Happy path.** Daniel (o cualquier miembro con las credenciales) visita `https://<dominio>/`, el navegador pide usuario/contraseña (BasicAuth), las ingresa correctamente, y el dashboard de `metrics-hub` se sirve normalmente por HTTPS.

**B — Acceso sin credenciales.** Alguien visita el dominio sin enviar credenciales (curl sin `-u`, o cancela el prompt del navegador). Traefik responde `401 Unauthorized` con el challenge `WWW-Authenticate: Basic`, sin que el contenido del dashboard llegue a servirse.

**C — Credenciales incorrectas.** Alguien envía usuario o contraseña equivocados. Traefik responde `401` igual que en el escenario B — no hay diferencia de comportamiento observable entre "sin credenciales" y "credenciales inválidas" (evita filtrar si el usuario existe).

**D — Regresión de la política post-incidente.** Alguien intenta `curl http://148.113.203.22:4320` (puerto directo, sin pasar por Traefik/dominio) desde fuera del VPS. La conexión debe seguir sin establecerse — el binding a `127.0.0.1` y `omnia-portblock` (ver `DEPLOY_COOLIFY.md`) siguen vigentes y esta feature no los toca. Si este escenario deja de fallar, es una regresión de seguridad, no un síntoma de que la feature "funciona mejor".

**E — Dominio mal propagado (edge case operativo).** El DNS del dominio elegido todavía no resuelve a la IP del VPS, o el certificado TLS de Coolify (Let's Encrypt) aún no se emitió. El dashboard no es alcanzable por el dominio durante ese período; el túnel SSH manual sigue funcionando como fallback mientras tanto — esta feature no lo reemplaza, lo complementa.

**F — Coolify ignora o sobreescribe el label personalizado (edge case de configuración).** Las labels se agregan correctamente a `docker-compose.yml`, pero Coolify — comportamiento documentado en issues públicos del proyecto para deploys tipo Docker Compose — las ignora o las sobreescribe durante el deploy, y el middleware nunca queda realmente aplicado. El síntoma es que el dominio sirve el dashboard sin pedir credenciales, indistinguible a simple vista de un deploy "exitoso" si no se verifica explícitamente. Este escenario es exactamente lo que valida AC-009 en `2_acceptance-criteria.md`: no basta con que el dominio "funcione" ni con que la label esté en el archivo — hay que confirmar, inspeccionando el contenedor real, que el middleware quedó efectivamente activo.

## Alcance

### Incluye:

- Elegir un dominio para `metrics-hub` (ej. `metrics.omniaos.ai`) y agregarlo al recurso Coolify correspondiente.
- Generar un hash bcrypt de usuario/contraseña (`htpasswd` o su equivalente vía Docker) para el middleware BasicAuth.
- Agregar a `metrics-hub/docker-compose.yml` las dos labels de Traefik que declaran el middleware `basicauth` y lo enganchan al router autogenerado del servicio (label `coolify.traefik.middlewares`) — commit + push incluidos.
- Redeploy del recurso en Coolify para que Traefik recargue la config (sin rebuild de imagen).
- Verificación manual de los 4 escenarios (A-D) de esta spec, incluyendo inspección de las labels efectivas del contenedor desplegado (no solo del archivo).
- Documentar el dominio final (una vez elegido) en la sección `metrics-hub/` de `DEPLOY_COOLIFY.md`, reemplazando la línea actual "sin dominio configurado".

### No incluye:

- Cambiar la política de binding a `127.0.0.1` de ningún puerto — sigue vigente para los tres servicios (`gateway`, `memory`, `metrics-hub`). Esta feature es aditiva (agrega una vía de acceso autenticada), no reemplaza la política post-incidente.
- Agregar autenticación a nivel de aplicación dentro del código de `metrics-hub` (login, sesiones, JWT, etc.). La autenticación vive en el proxy (Traefik) vía labels declarativas, no en lógica de aplicación del repo.
- Modificar `metrics-hub/Dockerfile`, `docker-entrypoint.sh`, `scripts/*` o `dashboard/*` — el único archivo de código que cambia es `metrics-hub/docker-compose.yml`, y solo en su bloque `labels:`.
- Exponer `gateway` o `memory` de forma distinta a como están hoy — fuera de alcance de esta feature (ver feature separada `port-exposure-alerts` en el mismo sprint para monitoreo de exposición de puertos).
- Rotación o gestión de credenciales a largo plazo (ej. vault de secrets) — el usuario/contraseña BasicAuth se define una vez como parte de esta feature; su ciclo de vida posterior no está cubierto aquí.

## Dependencias

### Esta feature depende de:

- El fix de seguridad post-incidente (commit `82cba23`, 24-jul-2026) que dejó todos los puertos en loopback-only. Ya está aplicado — es el estado actual del repo, no un prerrequisito pendiente.
- Que Daniel (o quien ejecute la spec) tenga acceso a la consola de Coolify del recurso `metrics-hub`. Confirmado en el contexto de esta tarea: "el human (Daniel, el dueño del repo, que ahora tiene acceso a Coolify)".
- Que exista (o se pueda crear) un registro DNS controlable para el dominio elegido, apuntando a `148.113.203.22`. Si se reutiliza un wildcard `*.omniaos.ai` ya usado por `gateway`/`memory`, este punto ya está resuelto y no requiere acción adicional.
- `find-related-specs` no encontró ninguna spec previa relacionada (`vision/specs/` estaba vacío al momento de crear esta spec — es la primera feature especificada en todo el repo), así que no hay una spec de infraestructura de Coolify previa de la que heredar convenciones; esta spec establece el patrón para futuras features similares (ej. `port-exposure-alerts`).

### Esta feature es requerida por:

- Ninguna feature depende de esta para poder implementarse (es una hoja en el grafo de dependencias). Está relacionada por dominio (ambas en `services/`, ambas sobre exposición de puertos) con `port-exposure-alerts` (mismo Sprint 1), pero no hay una dependencia dura: esa feature puede implementarse antes o después sin bloquear a esta.
- Indirectamente, cierra uno de los puntos pendientes explícitos que ya menciona `DEPLOY_COOLIFY.md` ("Ponerle Traefik + BasicAuth vía la consola de Coolify ... es el punto 6 de la lista de pendientes del repo") — esta spec es la formalización de ese pendiente, no una tarea nueva inventada desde cero.

## Impacto

**Archivos del repo modificados:**

- `metrics-hub/docker-compose.yml` — agrega un bloque `labels:` al servicio `metrics-hub` con el middleware BasicAuth (incluye el hash bcrypt de las credenciales; la contraseña en texto plano nunca se escribe aquí ni en ningún otro archivo). `ports`, `environment`, `image`, `volumes` no cambian.
- `DEPLOY_COOLIFY.md` — sección `### \`metrics-hub/\`` actualizada con el dominio final (placeholder `<dominio a confirmar>` hasta que se elija en Coolify).

**Archivos del repo NO modificados:**

- `metrics-hub/Dockerfile`, `metrics-hub/docker-entrypoint.sh`, `metrics-hub/scripts/*`, `metrics-hub/dashboard/*` — sin cambios. No hay rebuild de imagen.

**Config fuera del repo (no versionada en git):**

- Recurso `metrics-hub` en la consola de Coolify: el dominio nuevo se agrega ahí (no en el repo). El redeploy que aplica las labels también se dispara desde Coolify.

**Sin impacto en runtime del servicio:** no se requiere rebuild de la imagen `omnia/metrics-hub:latest` ni cambia el comportamiento del proceso Node dentro del contenedor — Traefik intercepta y autentica el tráfico *antes* de que llegue al contenedor.

**Impacto en otros recursos de Coolify:** ninguno esperado, siempre que el middleware quede atado exclusivamente al router de `metrics-hub` (ver Escenario F e INV-6 en `1_spec.md`). `gateway` y `memory` no deben pedir BasicAuth después de esta feature si no lo pedían antes — esto se valida explícitamente en `3_test-plan.md` (Paso 10).

**Impacto en el flujo de trabajo del equipo:** una vez validado, el acceso habitual al leaderboard deja de requerir SSH — cualquier miembro con las credenciales BasicAuth puede entrar desde el navegador. El túnel SSH no se retira como opción (sigue siendo útil para debugging directo del contenedor), pero deja de ser la única vía.

## Notas de Implementación

No hay work item de Plane asociado. El proyecto de Plane configurado en el constitution (`ca75c562-081c-4236-904d-b403484dcf7d`) no tiene work items creados todavía (`plane-sync list-pending-tasks` devolvió 0 resultados al momento de crear esta spec) — la feature viene directamente del backlog (`vision/backlog.md`, Sprint 1 — Cierre de gaps operativos post-incidente), donde ya estaba listada como pendiente.

> Supuesto: el nombre de dominio final (ej. `metrics.omniaos.ai`) no se fija en esta spec — es una decisión del humano al configurar Coolify. Todos los archivos de esta spec usan `<dominio a confirmar>` como placeholder donde correspondería un dominio concreto.
