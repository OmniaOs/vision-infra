# Feature: Verificar plane-sync end-to-end

## Metadata

```yaml
status: pending
created: 2026-08-27
updated: 2026-08-27
dependencies: none
position: 2
plane_workitem_id: null
```

## User Stories

**Como** Daniel (PM / dueño entrante de `vision-infra`) **Quiero** tener confirmación real de que la skill `plane-sync` sincroniza el ciclo de vida de las features con Plane **Para** poder confiar en que cuando `/executespec` o `/onspecomplete` dicen "sincronizado con Plane", el work item correspondiente en `management.omniaos.ai` de verdad cambió de estado — sin tener que verificarlo a mano cada vez.

**Como** cualquier desarrollador que ejecute `/newspec`, `/executespec` u `/onspecomplete` sobre una feature de `vision-infra` de aquí en adelante **Quiero** que el mensaje de éxito de `plane-sync` refleje la realidad de Plane **Para** no terminar con specs marcadas `done` en el repo mientras el work item asociado sigue en `Todo` en el tracker del equipo — una divergencia silenciosa que nadie notaría hasta una revisión manual.

**Como** mantenedor de `VisionFramework` (el framework compartido por todos los repos de Omnia, no solo `vision-infra`) **Quiero** que la sintaxis exacta del filtro PQL usado por `list-pending-tasks` quede confirmada — y corregida si el guess original estaba mal — **Para** que otros repos que adopten la integración con Plane después de `vision-infra` no repitan el mismo tanteo a ciegas contra una conexión MCP real.

## Naturaleza del Artefacto

Esta feature **no es código de aplicación de `vision-infra`**. Es una verificación operativa ejecutada por un agente con acceso al MCP de Plane, sobre datos reales (pero explícitamente descartables) del proyecto `Vision Infra` (`VINF`) ya conectado. Su resultado puede tener **dos** efectos de código posibles, en repos distintos:

1. Ningún cambio de código, si el guess de sintaxis PQL documentado en `VisionFramework/skills/plane-sync.md` resulta correcto al probarlo contra el MCP real (Escenario A).
2. Un commit en el repo **`VisionFramework`** (no en `vision-infra`) que corrige `skills/plane-sync.md`, si el guess resulta incorrecto (Escenario B). Este es un punto explícito de esta spec: **el archivo a corregir no vive en este repositorio**. Ver "Dependencias" e "Impacto" más abajo.

No hay ningún cambio previsto en el código de `vision-infra` propiamente dicho (`gateway/`, `memory/`, `metrics-hub/`). Por eso `1_spec.md` describe un runbook de verificación (pasos + llamadas MCP concretas), no una implementación de módulo; y `3_test-plan.md` es validación manual con **llamadas MCP reales**, no HTTP (`curl`) — el objeto bajo prueba es una integración de herramientas de Claude Code, no un servicio expuesto por red. El constitution de este repo declara `Testing: ninguno configurado todavía`, así que tampoco existe un harness automatizado que pudiera cubrir esto.

## Propósito

En una sesión previa de este mismo repo ocurrieron, en orden, tres cosas:

1. La organización reemplazó su sistema de tareas: ClickUp → Plane (self-hosted en `management.omniaos.ai`, workspace `omnia`).
2. Un agente en background reemplazó por completo el soporte de ClickUp por soporte de Plane en el repo hermano `VisionFramework` (`skills/clickup-sync.md` eliminado, `skills/plane-sync.md` agregado, los 4 workflows del framework y sus templates actualizados) — commit `34df830` ("feat(sync): reemplazar integración ClickUp por Plane").
3. `vision-infra` corrió `/setup` y se conectó a un proyecto Plane recién creado, **"Vision Infra"** (identificador `VINF`, `project_id: ca75c562-081c-4236-904d-b403484dcf7d`), con el bloque `## Integración Plane` de `vision/constitution.md` ya en `enabled: true`, `status_map: {pending: "Todo", in-progress: "In Progress", done: "Done"}` y `task_match: {method: "by-name", custom_field_name: null}`.

El problema que cierra esta feature: **`VisionFramework/skills/plane-sync.md` nunca se probó contra una conexión MCP de Plane real** al momento de escribirse. Su propio autor lo dejó marcado explícitamente en dos puntos (buscar la frase literal `no se ha podido confirmar` en ese archivo):

1. **Paso 5 de `list-pending-tasks`** (helper `resolveStateId` ya resuelto, pero el filtro PQL en sí no): la skill asume un filtro del estilo `state = "<uuid>"` para listar work items por estado resuelto, pero anota que "la sintaxis exacta de un filtro `pql` por estado ... no se ha podido confirmar contra una conexión MCP de Plane real al escribir esta skill" y remite a `get_pql_reference` si falla.
2. **Estrategia 3 de `resolveWorkitem`** (fallback por propiedad personalizada, usado solo cuando `task_match.method == "by-custom-field"`): la skill no confirma cómo leer el valor de una propiedad personalizada de un work item devuelto por `workitem action=list` (vía `expand`/`fields`).

El MCP de Plane ya está confirmado funcionando en esta máquina (conectado vía `uvx`, en `C:\Users\carri\.local\bin\uvx.exe`, con ~30 herramientas incluyendo `mcp__plane__workitem`, `mcp__plane__state`, `mcp__plane__project`, `mcp__plane__get_pql_reference`), así que existe la vía técnica para probar el punto 1 directamente contra el proyecto `VINF`. El punto 2 es **moot para `vision-infra` específicamente** (nuestro `task_match.method` es `by-name`, esa rama de código nunca se ejecuta en este repo), pero sigue siendo un gap real en una skill compartida que otros repos de Omnia podrían configurar con `by-custom-field` más adelante — vale la pena dejarlo señalado explícitamente aunque cerrarlo del todo esté fuera de alcance aquí.

## Escenarios

**A — Happy path.** Se crea un work item de prueba en `VINF`, `list-pending-tasks` lo encuentra en su primer intento (el guess de PQL era correcto), `mark-in-progress` cambia su estado real a "In Progress" (verificado por `retrieve`, no solo por el mensaje de la skill), una segunda invocación de `mark-in-progress` reporta `already-in-target-status` sin update redundante, `mark-done` cambia el estado real a "Done", y el item se borra al final sin dejar residuo en el workspace compartido.

**B — El guess de PQL estaba mal.** `list-pending-tasks` no incluye el work item de prueba (o la llamada MCP subyacente falla) pese a que el item existe en el estado mapeado a `pending`. Se diagnostica con `get_pql_reference`, se corrige la sintaxis real en `VisionFramework/skills/plane-sync.md`, se commitea **en ese repo** (cross-repo, no en `vision-infra`), y se vuelve a ejecutar `list-pending-tasks` para confirmar que ahora sí encuentra el item.

**C — El mensaje de la skill miente sobre el estado real.** `mark-in-progress` reporta éxito (`transition-success`), pero una llamada independiente de `retrieve` muestra que el work item sigue en su estado anterior. Esto invalidaría la verificación — no se puede cerrar esta feature confiando en el texto de salida de `plane-sync`, exactamente el motivo por el que existe esta spec.

**D — La idempotencia falla en la práctica, no solo en el mensaje.** La segunda invocación de `mark-in-progress` imprime `already-in-target-status`, pero al comparar `updated_at` del work item antes/después se detecta que sí hubo una llamada `workitem action=update` de todos modos (contradice la Regla Clave 2 de `plane-sync.md`: "nunca hace un update redundante"). Esto también invalidaría la verificación de esa AC específica.

**E — Cleanup incompleto (edge case operativo).** El paso final de borrado (`workitem action=delete`) falla por permisos o por un UUID guardado incorrectamente, dejando el item `zz-test-verify-plane-sync` huérfano en el proyecto `VINF` — visible para cualquier otro miembro del equipo que abra Plane. Este escenario es exactamente lo que valida AC-010/AC-011: el cleanup no es opcional, es parte del criterio de cierre de la feature.

**F — MCP no conectado al momento de ejecutar esta spec.** Quien corra `/executespec verify-plane-sync-end-to-end` no tiene el MCP de Plane conectado en su máquina/IDE. No debe simular los pasos ni marcar ACs como pasados de memoria — debe reportar la feature como bloqueada (mismo patrón que la Naturaleza de Este Documento de `expose-metrics-hub-domain/1_spec.md` para bloqueos de acceso a infraestructura externa) y, si aplica, documentar cómo se conectó el MCP en esta máquina para que quien retome la spec en otra máquina no repita el proceso a ciegas.

**G — Ambigüedad de nombre por una corrida anterior sin cleanup.** Si una ejecución previa de esta misma verificación falló antes de llegar al paso de borrado, podría existir ya un work item `zz-test-verify-plane-sync` en `VINF` al momento de crear uno nuevo. `resolveWorkitem` por nombre (Estrategia 2 de `plane-sync.md`) trata más de un match como ambigüedad y devuelve `null` (Caso Especial 8) — el ejecutor debe revisar y limpiar work items de prueba preexistentes antes de crear uno nuevo, no asumir que el workspace está limpio.

## Alcance

### Incluye:

- Crear **un** work item de prueba real en el proyecto `VINF` vía `mcp__plane__workitem` (`action: "create"`), con nombre inequívoco `zz-test-verify-plane-sync` (prefijo `zz-test-` para que nadie lo confunda con trabajo real al verlo en la UI de Plane).
- Ejecutar `plane-sync list-pending-tasks` y confirmar que el item aparece; si no aparece, diagnosticar y corregir el filtro PQL del Paso 5 de `VisionFramework/skills/plane-sync.md` (cross-repo).
- Ejecutar `plane-sync mark-in-progress zz-test-verify-plane-sync` y verificar el cambio de estado real vía `mcp__plane__workitem` (`action: "retrieve"`), no solo el mensaje de la skill.
- Reinvocar `mark-in-progress` una segunda vez para confirmar idempotencia real (mensaje `already-in-target-status` **y** `updated_at` sin cambios).
- Ejecutar `plane-sync mark-done zz-test-verify-plane-sync` y verificar el estado final ("Done") de la misma forma independiente.
- Borrar el work item de prueba (`mcp__plane__workitem`, `action: "delete"`) como paso de cierre obligatorio.
- Registrar el resultado de la verificación del gap de PQL (confirmado sin cambios, o corregido) en algún lugar durable — ver `1_spec.md` → Algoritmo → Paso 7 para las opciones concretas.
- Señalar explícitamente (sin resolver) el gap de la Estrategia 3 (`resolveWorkitem` por propiedad personalizada) para que quede documentado, aunque `vision-infra` no lo ejercite.
- Documentar, si hace falta reconstruir el entorno en otra máquina, qué se necesitó para conectar el MCP de Plane aquí (instalación de `uv`/`uvx`, cualquier ajuste de configuración con ruta absoluta) — ver Dependencias.

### No incluye:

- Verificar la Estrategia 3 de `resolveWorkitem` (fallback por propiedad personalizada) de punta a punta. `vision-infra` usa `task_match.method: "by-name"`, así que esa rama de código nunca se ejecuta aquí de forma natural — forzarla artificialmente estaría fuera del propósito de una verificación *end-to-end* (que por definición sigue el camino real de uso del repo). Queda flageada como gap conocido, no cerrada.
- Reconstruir la matriz completa de 6 fixtures (`fixture-no-plane`, `fixture-disabled`, `fixture-incomplete`, `fixture-valid-byname`, `fixture-valid-bycf`, `fixture-stale-status-map`) que ya cubre `VisionFramework/vision/specs/skills/skill-plane-sync/3_test-plan.md` en el repo dueño de la skill. Esta spec es un smoke test dirigido contra el uso real de `vision-infra` (un proyecto, un método de match, un flujo), no una re-certificación completa de la skill compartida.
- Automatizar esta verificación en un pipeline de CI o cron. No existe harness de test en este repo (`Testing: ninguno configurado todavía`, constitution) y no es parte de esta feature crear uno.
- Cambiar `status_map`, `task_match` o `project_id` en `vision/constitution.md` — esa configuración ya quedó fijada por `/setup` en la sesión previa y se da por correcta; esta spec la usa, no la modifica.
- Resolver ningún otro gap de `plane-sync.md` que no esté marcado explícitamente con la frase "no se ha podido confirmar" — los demás pasos de la skill (helper `resolveStateId`, degradación silenciosa, validación de `feature-name`) ya se consideran verificados por el propio autor de la skill.

## Dependencias

### Esta feature depende de:

- El MCP de Plane conectado y autenticado en la máquina que ejecute `/executespec` de esta spec. En esta máquina está confirmado funcionando (`uvx` en `C:\Users\carri\.local\bin\uvx.exe`, ~30 herramientas incluyendo `workitem`, `state`, `project`, `get_pql_reference`). **Nota de verificación de esta spec**: `DEPLOY_COOLIFY.md` de este repo documenta infraestructura del VPS de producción, no tooling MCP local — no contiene instrucciones para instalar/conectar el MCP de Plane en una máquina nueva. Si esta spec se ejecuta desde una máquina distinta a la actual, ese setup (instalar `uv`/`uvx`, resolver cualquier problema de ruta absoluta en la config del MCP) no está documentado en ningún archivo de este repo — preguntarle a Daniel antes de asumir que es trivial.
- El bloque `## Integración Plane` de `vision/constitution.md` con `enabled: true` y el proyecto `VINF` (`project_id: ca75c562-081c-4236-904d-b403484dcf7d`) ya creado en Plane — ambos ya existen, son el resultado de `/setup` en la sesión previa, no un prerrequisito pendiente de esta spec.
- Acceso de escritura al repo **`VisionFramework`** (`C:\Users\carri\OneDrive\Escritorio\Omnia\VisionFramework`), condicional al Escenario B: solo hace falta si el guess de sintaxis PQL resulta incorrecto y hay que corregir `skills/plane-sync.md` ahí. Esto es una dependencia cruzada entre repos digna de resaltar: **la spec vive en `vision-infra`, pero el posible fix de código vive en `VisionFramework`** — quien ejecute esta spec debe tener ambos repos disponibles, no asumir que todo el trabajo cabe en un solo `git commit` de `vision-infra`.
- `find-related-specs` (invocado durante la creación de esta spec) no encontró ninguna spec relacionada con relevancia ≥ 0.30 — la única spec existente en el repo (`expose-metrics-hub-domain`) tiene relevancia `0.00` (sin tokens compartidos: `{verify, plane, sync, end, to}` vs. `{expose, metrics, hub, domain}`). No hay, por tanto, una spec previa de la que heredar convenciones para verificaciones de integraciones MCP; esta spec establece el patrón para futuras verificaciones similares.

### Esta feature es requerida por:

- Ninguna feature depende de esta para poder implementarse (es una hoja en el grafo de dependencias de este repo). Está relacionada por **sprint y por dominio** (ambas en Sprint 1 — "Cierre de gaps operativos post-incidente", ambas features de infraestructura/operación) con `expose-metrics-hub-domain` y `port-exposure-alerts`, pero no hay dependencia dura ni con una ni con otra: los tres gaps del sprint (dominio de `metrics-hub`, alertas de exposición de puertos, verificación de `plane-sync`) son independientes entre sí y pueden implementarse en cualquier orden.
- Indirectamente, esta feature aumenta la confianza en que el resto del ciclo de vida del framework (`/newspec` → `/executespec` → `/onspecomplete`) queda correctamente reflejado en Plane para **todas** las features futuras de este repo, incluidas `expose-metrics-hub-domain`, `port-exposure-alerts` y `confirm-incident-scope-with-emilio` — pero eso es un beneficio derivado, no una dependencia formal que bloquee a esas features.

## Impacto

**Archivos de `vision-infra` modificados por esta spec (creación):**

- `vision/specs/core/verify-plane-sync-end-to-end/` (los 4 archivos de esta spec).
- `vision/backlog.md` — sin cambios de contenido; el ítem ya estaba listado en Sprint 1 antes de correr `/newspec` (confirmado en Prerrequisitos).
- `vision/vision-status.json` — nuevo entry `verify-plane-sync-end-to-end`, `status: "pending"`, `position: 2`.

**Archivos de `vision-infra` potencialmente modificados al *ejecutar* (no al especificar) esta feature:** ninguno, en el happy path (Escenario A). Esta spec no introduce cambios al código de ningún servicio Docker del repo.

**Archivos de `VisionFramework` (repo distinto) potencialmente modificados al ejecutar esta feature:**

- `skills/plane-sync.md` — **solo** si el Escenario B ocurre (el guess de PQL del Paso 5 resulta incorrecto). El cambio sería: reemplazar la sintaxis de filtro `pql` por la confirmada contra el MCP real, y quitar la nota "no se ha podido confirmar" de ese punto específico. Este commit, si ocurre, vive en `VisionFramework`, no en `vision-infra` — es la dependencia cruzada ya señalada arriba.

**Efecto lateral en el workspace compartido de Plane (`omnia`, proyecto `VINF`):** un work item de prueba (`zz-test-verify-plane-sync`) se crea y se borra durante la ejecución. Si el paso de cleanup (ver Escenario E) se completa correctamente, el efecto neto sobre el proyecto `VINF` es cero — ningún work item de prueba permanece visible para el resto del equipo.

**Sin impacto en runtime de ningún servicio de `vision-infra`:** esta feature no toca `gateway/`, `memory/` ni `metrics-hub/`.

## Notas de Implementación

No hay work item de Plane asociado a esta spec (`plane_workitem_id: null`). Esto es deliberado, no un descuido: durante la creación de esta spec (`/newspec`) **no se invocó ninguna herramienta `mcp__plane__*` ni la skill `plane-sync`**, para no generar efectos secundarios reales en el workspace compartido de Plane sin que un humano lo haya autorizado explícitamente. La feature viene directamente del backlog (`vision/backlog.md`, Sprint 1 — Cierre de gaps operativos post-incidente), donde ya estaba listada como pendiente antes de correr este workflow.

Por la misma razón, `list-pending-tasks` **no** se ejecutó como parte del Paso E3 habitual de `/newspec` (que normalmente consulta work items pendientes en Plane antes de la Pregunta 1) — se omitió deliberadamente aquí, ya que el origen de esta feature (backlog) y el sprint destino (Sprint 1, el único sprint existente) ya estaban resueltos sin necesidad de esa consulta.

Toda la interacción real con el MCP de Plane descrita en `1_spec.md` (crear el work item de prueba, listar, transicionar, borrar) es **trabajo futuro**, a ejecutar por quien corra `/executespec verify-plane-sync-end-to-end` con la participación real de un humano — no algo que esta creación de spec haya simulado o pre-completado.

> Supuesto: se asume que el proyecto `VINF` en Plane no tiene, al momento de ejecutar esta spec, ningún otro work item cuyo nombre normalizado colisione con `zz-test-verify-plane-sync` (ver Escenario G). Si lo hubiera (de una corrida anterior sin cleanup), el ejecutor debe limpiarlo manualmente antes de continuar — esta spec no incluye un paso de "detección de basura preexistente" automatizado.
