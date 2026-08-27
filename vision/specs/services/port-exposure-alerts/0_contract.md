# Feature: Alertas automáticas de exposición de puertos

## Metadata

```yaml
status: pending
created: 2026-08-27
updated: 2026-08-27
dependencies: none
position: 3
plane_workitem_id: null
```

## User Stories

**Como** responsable de seguridad de `vision-infra` **Quiero** un check periódico que detecte si algún contenedor de `gateway`, `memory` o `metrics-hub` vuelve a publicar un puerto fuera de `127.0.0.1` **Para** que una regresión del tipo que causó el incidente del 20-jul-2026 se note en horas, no en los ~4 días que tardó en descubrirse la exposición real de `openmemory-ui`.

**Como** Daniel (PM / dueño entrante de `vision-infra`) **Quiero** que la acción de seguimiento que el propio [postmortem](../../../../docs/postmortems/2026-07-20-openmemory-ui-rce.md) dejó abierta — *"No hay alertas automáticas configuradas para puertos publicados inesperadamente en el VPS — evaluar un check periódico (podría vivir en Hermes o en un cron simple) que avise si algo vuelve a publicarse fuera de loopback sin querer"* — quede formalizada en una spec concreta **Para** poder cerrar ese punto de la lista de pendientes del repo en vez de dejarlo como una frase suelta en un documento que nadie vuelve a leer.

**Como** operador que corre este check a mano o revisa su log tras una alerta **Quiero** un mensaje inequívoco (código de salida + línea de log) que distinga "todo en orden", "encontré un puerto expuesto", "no pude ni revisar" y "no había nada que revisar" **Para** no confundir un fallo operacional del propio check con una alerta de seguridad real, ni confundir un check que no corrió con uno que corrió y no encontró nada.

## Naturaleza del Artefacto

A diferencia de `expose-metrics-hub-domain` y `verify-plane-sync-end-to-end` (las otras dos specs de este Sprint 1, ambas acciones operativas puras sin código nuevo), esta feature **sí produce un artefacto de código real**: un script de shell (`ops/port-exposure-check/check.sh`) más su fixture de prueba local. No es una app ni un servicio nuevo — es una única herramienta de diagnóstico, del mismo espíritu que `guardrails/checks/lib.mjs` (una librería/script de infraestructura del repo, fuera de `gateway/`, `memory/` y `metrics-hub/`, que no se despliega como recurso Docker de Coolify).

Por eso `1_spec.md` incluye código real (no solo pseudocódigo de runbook), y `3_test-plan.md` describe una fixture de `docker-compose` ejecutable localmente — más cercano a un test de integración clásico que a los pasos de consola de las otras dos specs del sprint. Aun así, la **instalación** del cron job en `server-omniaplatform` sigue siendo un paso operativo manual (no hay CI/CD en este repo que lo automatice), así que esta spec combina ambas naturalezas: código versionado + un paso de despliegue manual único.

## Propósito

El commit `82cba23` (24-jul-2026) corrigió la causa raíz del incidente del 20-jul-2026: todos los puertos de los tres servicios de este repo pasaron a publicarse solo en `127.0.0.1`. Ese fix es correcto pero **estático** — nada impide que una edición futura de un `docker-compose.yml` (o de la configuración de un recurso en Coolify) reintroduzca un binding a `0.0.0.0` por error, exactamente como ocurrió la primera vez. El propio postmortem lo señala como punto abierto explícito (ver cita completa en User Stories), y esta feature es la formalización directa de esa línea — no una idea nueva inventada fuera del historial del repo.

El problema no es solo "reintroducir el bug", es la **falta de señal**: la primera vez, la exposición duró ~4 días sin que nadie la notara hasta la corrección. Un check periódico y barato — comparar el binding real de cada contenedor contra la política ya documentada (`127.0.0.1` únicamente) — convierte una regresión silenciosa en una línea de log detectable en la próxima ventana de ejecución del cron, en vez de en el próximo incidente.

Esta spec **no** resuelve seguridad de la VPS en general. El VPS aloja, además de los tres servicios de este repo, la plataforma de Coolify (`coolify-proxy`/Traefik, `coolify-sentinel`) que **legítimamente** necesita puertos públicos (80/443) para cumplir su función de reverse proxy — bloquear o alertar sobre eso sería un falso positivo permanente, no una mejora de seguridad. El alcance de esta feature es deliberadamente angosto: los contenedores de `gateway`, `memory` y `metrics-hub`, ni uno más.

## Escenarios

**A — Happy path.** El check corre en su ventana programada de cron en `server-omniaplatform`. Todos los contenedores de los tres servicios de este repo (`litellm`, `db`, `openmemory-mcp`, `mem0_store`, `hermes`, `metrics-hub`) tienen sus puertos publicados solo en `127.0.0.1` (o sin publicar, como `mem0_store` hoy). El check escribe una línea `OK` en su log y termina con código de salida `0`.

**B — Regresión detectada.** Alguien (por accidente, o por un futuro incidente) modifica el binding de un puerto de uno de los tres servicios a `0.0.0.0` o a una IP pública específica — vía un cambio a `docker-compose.yml`, o editando la config del recurso directamente en Coolify. En la siguiente corrida del cron, el check detecta el binding fuera de `127.0.0.1`, escribe una línea `ALERT` en el log con el nombre del contenedor, el puerto y el `HostIp` real, y termina con código de salida `1`. No hay notificación push (ver Alcance → No incluye) — la señal vive en el log hasta que un operador lo revise.

**C — Falso positivo evitado (`coolify-proxy`).** El contenedor `coolify-proxy` (Traefik) publica los puertos `80` y `443` a `0.0.0.0` — comportamiento legítimo y necesario para que Coolify enrute tráfico externo a los dominios de `gateway`/`memory`/`metrics-hub` (ver spec hermana `expose-metrics-hub-domain`, que depende de que Traefik sea alcanzable). El check nunca reporta esto como hallazgo, porque `coolify-proxy` no pertenece al allowlist de nombres de contenedor de esta feature — no está siendo evaluado, no es un caso excluido explícitamente de una regla más amplia.

**D — Falla operacional del propio check.** El comando `docker` no responde (daemon caído, o el usuario bajo el que corre el cron no tiene permiso sobre el socket de Docker). El check no puede completar la inspección, escribe una línea `ERROR` distinta de `ALERT`, y termina con código de salida `2`. Esto es deliberadamente distinto de "todo limpio" (código `0`): un check que no pudo correr no debe verse igual en el log que uno que corrió y no encontró nada.

**E — Cero contenedores en scope.** Ningún contenedor en ejecución coincide con el allowlist de prefijos de esta feature — porque los tres servicios están caídos, o porque Coolify cambió el patrón de nombres que usa y el allowlist quedó desactualizado. El check no puede asumir "todo limpio" cuando en realidad no inspeccionó nada: escribe una línea `WARN` y termina con código de salida `3`, distinto tanto de `OK` (código `0`) como de `ALERT` (código `1`).

**F — Puerto expuesto (`EXPOSE`) pero no publicado.** Un contenedor del allowlist tiene un puerto declarado en su Dockerfile (`EXPOSE`) pero sin ninguna entrada de host en `docker inspect .NetworkSettings.Ports` (no hay `ports:` para ese puerto en el `docker-compose.yml`, o está comentado). Esto no es una superficie de red nueva — nada en el host escucha ese puerto desde afuera — así que el check no lo trata como hallazgo. Ver INV-3 en `1_spec.md`.

## Alcance

### Incluye:

- Un script de shell (`ops/port-exposure-check/check.sh`) que enumera los contenedores en ejecución cuyo nombre coincide con un allowlist de prefijos (`litellm`, `db`, `openmemory-mcp`, `mem0_store`, `hermes`, `metrics-hub` — los seis nombres de contenedor documentados en `DEPLOY_COOLIFY.md` para los tres servicios de este repo) e inspecciona sus bindings de puerto vía `docker inspect`.
- Detección de cualquier binding cuyo `HostIp` sea distinto de `127.0.0.1` en esos contenedores, tratándolo como hallazgo.
- Un log de auditoría por corrida (limpia o no) en el VPS, para que un operador pueda revisar el historial sin depender de la memoria de si el check corrió o qué encontró.
- Códigos de salida distintos para limpio / hallazgo / error operacional / cero-contenedores-en-scope (ver Escenarios A-E).
- Una fixture de `docker-compose` + un script de prueba, ejecutables en cualquier máquina con Docker local, que validan el detector sin tocar `server-omniaplatform`.
- La instalación de un cron job en `server-omniaplatform` (crontab de `root`, dado que ya es el usuario bajo el que corren `occ-agent` y el resto de servicios del sistema en ese nodo) que invoca el script periódicamente.
- Una actualización a `DEPLOY_COOLIFY.md` documentando que el check existe, dónde vive su log, y cómo leerlo (incluyendo la opción de leerlo vía las herramientas genéricas de archivos/terminal de OCC, sin SSH).

### No incluye:

- **Notificaciones push** (Slack, email, WhatsApp, o cualquier otro canal). Este repo no tiene ningún webhook ni integración de notificaciones configurada hoy — ni en `gateway/`, ni en `memory/`, ni en `metrics-hub/` (confirmado revisando los tres `.env.example`/`docker-compose.yml` del repo). El componente `notif-worker` de OCC sí hace esto, pero pertenece a un producto distinto (Omnia Control Center, soporte remoto multi-cliente), no a `vision-infra` — inventar esa integración aquí sería construir sobre un canal que no existe. Esta feature se detiene en "detectar + loguear + salir con código distinto de cero"; cablear una notificación real es trabajo futuro explícito, a retomar cuando exista un canal.
- **Monitoreo de seguridad general de la VPS.** El objetivo no es "cero puertos no-loopback en todo el host" — `coolify-proxy` necesita 80/443 públicos para funcionar, y ese es un problema de Coolify/la plataforma, no de este repo. El alcance es estrictamente los contenedores de `gateway`, `memory` y `metrics-hub`.
- **Integrar el check en OCC.** Se consideró explícitamente y se descarta — ver "Alternativas Consideradas" en `1_spec.md` para el razonamiento completo. En resumen: OCC es un producto de soporte remoto multi-tenant separado de este repo, y sus herramientas actuales (`services_list`, `processes_list`) no exponen bindings de puertos de contenedores Docker — no hay match natural.
- **Pipeline de CI/CD que mantenga el script actualizado en el VPS.** El despliegue inicial del script al host, y cualquier actualización posterior, es un paso manual documentado (`git pull` sobre un checkout dedicado en el VPS) — igual que el resto de este repo no tiene CI hoy (`Testing: ninguno configurado todavía`, constitution).
- **Remediación automática.** El check nunca modifica `docker-compose.yml`, la config de Coolify, ni el estado de ningún contenedor. Solo detecta y reporta.
- **Verificar excepciones legítimas más allá de `coolify-proxy`.** No se conoce ninguna otra excepción hoy (`omnia-portblock` ya bloquea a nivel de VPS cualquier puerto publicado tras el arranque de Docker, per `DEPLOY_COOLIFY.md`). Si en el futuro un servicio legítimo de este repo necesita un puerto público, el allowlist de esta feature necesitará una excepción explícita — no cubierta por esta versión de la spec.

## Dependencias

### Esta feature depende de:

- El fix de seguridad post-incidente (commit `82cba23`, 24-jul-2026) que estableció la política `127.0.0.1`-only como la baseline que este check protege. Ya aplicado — es el estado actual del repo, no un prerrequisito pendiente.
- El servicio `cron` del sistema en `server-omniaplatform`: confirmado `running`, `startType: enabled` (verificado en vivo vía `occ services_list` sobre el nodo `server-omniaplatform`, 2026-08-27, como parte de la exploración de esta spec — no es una suposición). No se requiere instalar ni activar nada nuevo para tener un scheduler disponible.
- El Docker Engine y su CLI en el host, ya requeridos por el propio funcionamiento de Coolify (`docker` confirmado `running`/`enabled` en el mismo chequeo de `services_list`) — el script de esta feature no agrega ninguna dependencia de runtime nueva al VPS (no requiere Node, Python, ni ningún paquete adicional; ver "Alternativas Consideradas" en `1_spec.md` sobre por qué se eligió bash en vez de Node pese a que el resto del repo es mayormente Node/Python).
- Acceso de `root` (o un usuario en el grupo `docker`) en `server-omniaplatform` para instalar el cron job — mismo nivel de acceso que ya requiere `DEPLOY_COOLIFY.md` para cualquier operación de VPS de este repo.
- `find-related-specs` (invocado durante la creación de esta spec) no encontró ninguna spec con relevancia ≥ 0.30 — las dos specs existentes del repo (`expose-metrics-hub-domain`, relevance 0.00; `verify-plane-sync-end-to-end`, relevance 0.00) no comparten tokens con `port-exposure-alerts` bajo el algoritmo de tokenización de la skill. No hay, por tanto, una dependencia formal ni una spec previa de la que heredar convenciones de script/testing local — esta spec establece el patrón para futuro código de infraestructura de este repo (junto con el precedente ya existente, pero anterior a Vision V2, de `guardrails/checks/`).

### Esta feature es requerida por:

- Ninguna feature depende de esta para poder implementarse (es una hoja en el grafo de dependencias). Relacionada por **sprint y por dominio** (ambas en Sprint 1 — "Cierre de gaps operativos post-incidente", ambas sobre exposición de puertos) con `expose-metrics-hub-domain`, pero son complementarias, no dependientes: esa feature *abre* deliberadamente una vía de acceso autenticada a `metrics-hub` vía Traefik; esta feature *vigila* que nada más se abra sin querer. Pueden implementarse en cualquier orden — de hecho, si `expose-metrics-hub-domain` se implementa primero, el allowlist de esta feature no necesita ningún ajuste: el dominio de `metrics-hub` se sirve vía `coolify-proxy` (fuera del scope de este check), no cambia el binding del puerto `4320` del propio contenedor `metrics-hub` (que sigue en loopback, INV-1 de esa spec).

## Impacto

**Archivos nuevos:**

- `ops/port-exposure-check/check.sh` — el script principal.
- `ops/port-exposure-check/README.md` — instrucciones de instalación del cron job y de ejecución de la fixture de prueba local.
- `ops/port-exposure-check/test/docker-compose.fixture.yml` — fixture de contenedores desechables para pruebas locales.
- `ops/port-exposure-check/test/run-fixture-test.sh` — script que levanta la fixture, corre `check.sh` contra ella, valida el resultado, y limpia.

**Archivos modificados:**

- `DEPLOY_COOLIFY.md` — nueva sub-sección documentando el check, el cron, la ubicación del log y cómo consultarlo.

**Archivos NO modificados (explícito):**

- `gateway/docker-compose.yml`, `memory/docker-compose.yml`, `metrics-hub/docker-compose.yml` — sin cambios. Este check es de solo lectura (`docker ps` / `docker inspect`); nunca escribe configuración de ningún servicio.
- `memory/hermes/*` — sin cambios. Se consideró y se descartó correr este check dentro de Hermes (ver "Alternativas Consideradas" en `1_spec.md`); el código de Hermes no se toca.

**Config fuera del repo (no versionada en git):**

- Una entrada nueva en el crontab de `root` en `server-omniaplatform`.
- El directorio de log `/var/log/omnia/` en el host (creado por el propio script si no existe).
- Un checkout dedicado del script en el VPS (fuera de los directorios de build que gestiona Coolify por recurso) — el mecanismo exacto de cómo llega el script al host se documenta en el Algoritmo de `1_spec.md`.

**Sin impacto en runtime de ningún servicio:** el check nunca reinicia, reconstruye ni modifica ningún contenedor de `gateway`, `memory` o `metrics-hub` — solo los inspecciona.

## Notas de Implementación

No hay work item de Plane asociado (`plane_workitem_id: null`). Se invocó `plane-sync list-pending-tasks` como parte de la creación de esta spec (Paso E3 del modo express de `/newspec`): el proyecto `VINF` (`project_id: ca75c562-081c-4236-904d-b403484dcf7d`) sigue sin ningún work item creado (`workitem action=list` devolvió `total_count: 0`, igual que cuando se creó `expose-metrics-hub-domain`). La feature viene directamente del backlog (`vision/backlog.md`, Sprint 1), donde ya estaba listada como pendiente antes de correr este workflow.

> Supuesto: se asume que el cron del check corre bajo `root` en `server-omniaplatform`, por ser el usuario bajo el que ya corren `occ-agent` y el resto de servicios de sistema en ese nodo (confirmado vía `occ services_list`, que no reporta ningún usuario de servicio dedicado y distinto de root para este VPS). Si en el futuro se crea un usuario de despliegue dedicado con acceso al grupo `docker`, el cron job puede moverse ahí sin cambios al script.

> Supuesto: el prefijo `db` en el allowlist (contenedor Postgres del `gateway`) es el más genérico de los seis y podría, en teoría, coincidir con un contenedor de Postgres de otra app de Coolify en el mismo host si el VPS empieza a alojar más servicios no relacionados con `vision-infra`. Hoy no es un problema real — `DEPLOY_COOLIFY.md` no documenta ninguna otra app en `server-omniaplatform` además de los tres servicios de este repo y la plataforma de Coolify — pero queda anotado como límite conocido a revisar (ver "Manejo de Errores" y "Alternativas Consideradas" en `1_spec.md`) si esa suposición deja de sostenerse.
