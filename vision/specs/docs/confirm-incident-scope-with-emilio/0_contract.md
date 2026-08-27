# Feature: Confirmar alcance del incidente con Emilio

## Metadata

```yaml
status: pending
created: 2026-08-27
updated: 2026-08-27
dependencies: none
position: 4
plane_workitem_id: null
```

## User Stories

**Como** Daniel (PM / dueño entrante de `vision-infra`) **Quiero** tener respuestas de primera mano de Emilio a las preguntas que el [postmortem del incidente del 20-jul-2026](../../../../docs/postmortems/2026-07-20-openmemory-ui-rce.md) dejó marcadas `[CONFIRMAR CON EMILIO]` **Para** poder cerrar mi propia evaluación de riesgo del incidente (¿hace falta notificar a alguien más? ¿hay que preservar logs antes de que la rotación los borre?) sobre hechos reales, no sobre inferencias reconstruidas después del hecho a partir solo del historial de git.

**Como** Emilio Dabdoub (autor de el 100% de los commits de este repo hasta la fecha, incluido el propio commit del fix de seguridad `82cba23`, y la única persona con conocimiento de primera mano del incidente) **Quiero** recibir una lista concreta y acotada de preguntas en vez de un "¿qué pasó?" abierto **Para** poder responder en el tiempo real que tiene disponible, sin tener que reconstruir él mismo todo el contexto que el postmortem ya reconstruyó por su cuenta.

**Como** cualquier persona que lea el postmortem después de esta feature (incluido el propio Daniel dentro de unos meses) **Quiero** que cada marcador `[CONFIRMAR CON EMILIO]` haya sido reemplazado por una respuesta fechada y atribuida — o, si genuinamente no se puede determinar, por un "no se puede determinar" igual de fechado y atribuido **Para** no encontrarme un documento que sigue diciendo "pendiente de confirmar" indefinidamente, sin poder distinguir si nadie preguntó o si la pregunta simplemente no tiene respuesta posible.

## Naturaleza del Artefacto

Las tres specs anteriores de este mismo Sprint 1 ya se apartaban de "código de aplicación" convencional, pero cada una conservaba *algo* ejecutable por un agente: `expose-metrics-hub-domain` es una acción de consola con comandos `curl` verificables al final; `verify-plane-sync-end-to-end` es una verificación real contra un MCP; `port-exposure-alerts` produce un script de shell de verdad. Esta feature no tiene ningún artefacto técnico intermedio de ese tipo. **No hay comando que correr, consola que abrir, ni MCP que invocar como parte del núcleo de la feature.** Su única acción es que un ser humano (quien ejecute `/executespec confirm-incident-scope-with-emilio`) le escriba o le hable a otro ser humano específico y con nombre — Emilio Dabdoub, `emilio@estrategiasdi.com` / `admin@omniaos.ai` — y espere una respuesta real antes de poder cerrar nada.

`/executespec` sobre esta feature **no genera ningún contenido de forma autónoma**. Lo máximo que un agente puede hacer al "implementar" esta spec es:

1. Presentar el mensaje ya redactado (`1_spec.md` → Algoritmo → Paso 1) — no requiere composición adicional, solo copiarlo y enviarlo por el canal real.
2. Confirmar con el humano qué canal usar para contactar a Emilio (esta spec no fija uno — ver "Supuesto" al final).
3. **Reportar la feature como bloqueada, no como completada**, hasta que la conversación real haya ocurrido y las respuestas estén documentadas en el postmortem.

Un agente que marque esta feature como `done` sin que Emilio haya respondido de verdad — inventando, infiriendo o "completando razonablemente" una respuesta en su lugar — repetiría exactamente el problema que esta feature existe para cerrar. El postmortem original ya es una reconstrucción hecha sin la persona correcta en la sala; su banner inicial lo admite con honestidad ("Los campos marcados **[CONFIRMAR CON EMILIO]** son inferencias razonables ... no hechos verificados de primera mano"). Esta spec no tolera que ese mismo patrón — inferir en lugar de preguntar — se repita en su propia ejecución. Es, en ese sentido específico, una feature sobre no dejar que un agente resuelva algo que solo un humano puede resolver.

Por esto `1_spec.md` no tiene una sección de "Stack Técnico" en el sentido convencional ni un modelo de datos de aplicación — lo más parecido es la estructura de las 3 preguntas y sus estados posibles de respuesta. Y `3_test-plan.md` no ejecuta ningún comando de verificación de comportamiento — "testear" esta feature es releer el postmortem después y confirmar, con los ojos (y con un `grep` como respaldo mecánico), que ningún marcador `[CONFIRMAR CON EMILIO]` sobrevivió sin resolver.

## Propósito

El postmortem (`docs/postmortems/2026-07-20-openmemory-ui-rce.md`) fue escrito el 2026-08-26 — más de un mes después del incidente y de su fix — reconstruido únicamente a partir del historial de git, porque nunca existió un postmortem original al momento del incidente. Esa reconstrucción dejó explícitamente sin resolver tres puntos, marcados los tres con el literal `[CONFIRMAR CON EMILIO]`:

1. **Alcance real de la explotación** (sección "Impacto" del postmortem):
   > **Alcance real de la explotación** — **[CONFIRMAR CON EMILIO]**: no hay
   > registro local de qué se ejecutó, si se leyeron/exfiltraron datos de la
   > memoria compartida (Qdrant/`mem0_store`), o si el atacante pivoteó a otros
   > contenedores del stack.

2. **Cómo se detectó el incidente** (sección "Causa raíz" del postmortem):
   > **Cómo se detectó** — **[CONFIRMAR CON EMILIO]**: no hay registro de si fue
   > monitoreo activo, un scan externo reportado, o hallazgo directo del
   > atacante notado por comportamiento anómalo.

3. Un ítem abierto explícito de la sección "Lecciones / acciones de seguimiento":
   > **Abierto — [CONFIRMAR CON EMILIO].** Reconstruir, aunque sea
   > aproximadamente, si hubo acceso/exfiltración real de datos de memoria
   > durante la ventana de exposición, revisando logs de Qdrant/OpenMemory si
   > todavía existen.

Emilio es la única persona con conocimiento de primera mano de estos tres puntos. Es el autor de el 100% de los commits de este repo hasta la fecha (confirmado vía `git log`, bajo dos identidades de commit distintas: `emiliodabdoub <emilio@estrategiasdi.com>` y `Emilio Dabdoub <admin@omniaos.ai>`), incluido el commit del fix de seguridad mismo, `82cba23` (24-jul-2026). Ninguno de estos tres puntos es inferible del código ni del historial de git — que es precisamente lo único que ya se usó para reconstruir el resto del documento y lo que llevó a marcarlos como pendientes en primer lugar.

Daniel, como dueño entrante de `vision-infra`, necesita estas respuestas para cerrar su propia evaluación de riesgo del incidente: si hubo acceso o exfiltración real de datos de la memoria compartida del equipo, eso podría implicar decisiones que exceden el alcance de esta spec (notificar a alguien más, auditar qué se guardó en esa memoria durante la ventana de exposición, evaluar si hace falta rotación de credenciales adicional a la ya aplicada en `82cba23`). Sin la respuesta, esa evaluación de riesgo queda apoyada indefinidamente en "no sabemos" — un resultado perfectamente válido si es la respuesta real y confirmada por la persona correcta, pero no si es simplemente que nadie llegó a preguntar.

## Escenarios

**A — Happy path.** Emilio responde con precisión a las 3 preguntas del mensaje. Las tres respuestas se documentan en el postmortem reemplazando cada marcador `[CONFIRMAR CON EMILIO]` por `[CONFIRMADO POR EMILIO — YYYY-MM-DD]` seguido del texto real de la respuesta.

**B — Respuesta parcial: "no se puede saber".** Emilio confirma que los logs de Qdrant/OpenMemory de la ventana del 20 al 24-jul ya no existen (rotados o borrados antes de que nadie pensara en revisarlos), así que no puede confirmar con certeza si hubo exfiltración real — solo puede decir lo que recuerda de memoria, si es que recuerda algo. Este es un resultado válido: se documenta explícitamente como "confirmado desconocido" (ver INV-3 de `1_spec.md`), no se deja el marcador original ni se inventa una respuesta más contundente de la que Emilio realmente puede dar.

**C — Emilio no responde en el corto plazo.** El mensaje se envía pero no hay respuesta dentro de un plazo razonable (días, no minutos — no hay SLA definido para esta conversación). La feature permanece `in-progress` o `pending`, nunca se fuerza a `done`. Reenviar el mensaje, escalar por otro canal, o decidir cuánto esperar es una decisión de Daniel, fuera del alcance mecánico de esta spec.

**D — La respuesta contradice el texto ya escrito.** El postmortem hoy asume, por ejemplo, que "no hay registro de si fue monitoreo activo" — pero la respuesta real de Emilio revela que sí hubo algo específico que no encaja con esa asunción (p. ej., que en realidad fue un aviso externo, no ausencia total de señal). En ese caso el texto incorrecto se corrige, no se deja al lado de un marcador de confirmación que valida por error una afirmación ya superada — ver INV-7 de `1_spec.md`.

**E — La respuesta revela exfiltración confirmada.** El impacto de una respuesta así trasciende el alcance de esta spec (decisiones de notificación adicional, remediación, auditoría de qué datos vivían en la memoria compartida). Esta feature documenta la respuesta igual que cualquier otra — completa y sin suavizarla — y dentro de "Alcance → No incluye" queda anotado explícitamente que cualquier acción derivada de ese hallazgo es trabajo futuro fuera de esta spec, a decidir por Daniel una vez tenga la respuesta real.

**F — Se revela una pregunta nueva no anticipada.** Emilio responde a las 3 preguntas originales pero, de paso, menciona algo que el postmortem no contemplaba (p. ej., duda sobre si la ventana de exposición fue realmente de 4 días exactos). Esto no bloquea el cierre de las 3 preguntas ya acotadas por esta spec — se documenta como hallazgo adicional en el propio postmortem si amerita, pero no se fuerza dentro del alcance ya cerrado de esta feature. Ver "Alcance → No incluye".

## Alcance

### Incluye:

- El texto exacto de las 3 preguntas a enviar a Emilio, derivadas directamente de los 3 marcadores citados en "Propósito" — sin inventar preguntas nuevas.
- Un mensaje completo, listo para copiar y enviar (en español, ver `1_spec.md` → Algoritmo → Paso 1), que agrupa las 3 preguntas de forma acotada y respetuosa del tiempo de Emilio.
- El envío real de ese mensaje a Emilio, por el canal que Daniel normalmente use para hablar con él (paso humano, no automatizable).
- La edición de `docs/postmortems/2026-07-20-openmemory-ui-rce.md` reemplazando cada uno de los 3 marcadores `[CONFIRMAR CON EMILIO]` por la respuesta real, con un marcador de procedencia y fecha (`[CONFIRMADO POR EMILIO — YYYY-MM-DD]`).
- Si alguna de las 3 preguntas resulta en "no se puede determinar" (Escenario B), registrar eso explícitamente con la misma disciplina de fecha y atribución — nunca como un TODO silencioso.
- Actualizar el banner inicial del postmortem ("Estado: borrador reconstruido...") una vez las 3 preguntas queden resueltas (con respuesta real o "no determinable"), para que el documento deje de decir "borrador reconstruido" cuando eso ya dejó de ser cierto.

### No incluye:

- Cualquier acción derivada de una respuesta que revele exfiltración real de datos — notificaciones a terceros, remediación adicional, auditoría de contenido de la memoria compartida, rotación de credenciales más allá de la ya aplicada en `82cba23`. Esa es una decisión de Daniel a tomar *después* de tener la respuesta, no parte mecánica de esta spec (ver Escenario E).
- El punto abierto separado del postmortem sobre alertas automáticas de exposición de puertos ("No hay alertas automáticas configuradas..."). Ese es el alcance completo de la feature hermana `port-exposure-alerts`, ya especificada en este mismo Sprint 1 — no se duplica aquí.
- Automatizar o programar el contacto con Emilio (bot de recordatorio, integración de mensajería). Es una conversación puntual y acotada, no un proceso recurrente — y este repo no tiene ninguna integración de notificaciones configurada hoy (confirmado en `port-exposure-alerts/0_contract.md`).
- Reconstruir un postmortem "perfecto" sin ningún marcador de incertidumbre. Si Emilio genuinamente no puede saber algo (Escenario B), esta spec documenta ese límite con la misma honestidad con la que el documento original marcó lo que no sabía — no lo oculta detrás de una respuesta inventada.
- Resolver cualquier pregunta nueva que surja de la conversación con Emilio pero que no estaba anclada a los 3 marcadores originales (Escenario F) — se anota como hallazgo si amerita, pero no forma parte del criterio de cierre de esta feature.

## Dependencias

### Esta feature depende de:

- La existencia del postmortem (`docs/postmortems/2026-07-20-openmemory-ui-rce.md`, creado en el commit `5d3d8b9`, 2026-08-26) — ya existe, no es un prerrequisito pendiente de esta spec.
- **La disponibilidad de Emilio para responder.** Esta es una dependencia humana explícita, distinta en naturaleza a las de las otras tres specs de este sprint: `expose-metrics-hub-domain` depende de acceso a la consola de Coolify, `verify-plane-sync-end-to-end` depende de un MCP conectado, `port-exposure-alerts` depende del Docker Engine del VPS — las tres son dependencias de infraestructura o tooling, resolubles por quien ejecuta la spec sin coordinación con un tercero. Esta feature depende de que una persona específica, ajena a quien ejecuta `/executespec`, esté disponible y dispuesta a responder. Si Emilio no está disponible, la feature simplemente no puede avanzar — no hay camino alternativo dentro de esta spec (ver Escenario C).
- `find-related-specs` (invocado durante la creación de esta spec) devolvió relevancia `0.00` contra las 3 specs existentes del repo (`expose-metrics-hub-domain`, `verify-plane-sync-end-to-end`, `port-exposure-alerts`) — ningún token compartido bajo el algoritmo de tokenización de la skill (`{confirm, incident, scope, with, emilio}` no interseca con ninguno de los otros tres conjuntos). No hay, por tanto, una dependencia formal ni una spec previa de la categoría `docs/` de la que heredar convenciones — esta es la primera spec de esa categoría en el repo, y establece el patrón para futuras features de naturaleza puramente documental/de comunicación.

### Esta feature es requerida por:

- Ninguna feature depende de esta para poder implementarse (es una hoja en el grafo de dependencias). Relacionada por **incidente de origen** (mismo incidente del 20-jul-2026) con `port-exposure-alerts`, pero sin dependencia dura: esa feature vigila que el vector de exposición de puertos no se repita hacia adelante; esta feature cierra la incertidumbre hacia atrás, sobre lo que ya pasó. Pueden ejecutarse en cualquier orden.
- Indirectamente, las respuestas obtenidas por esta feature podrían informar decisiones de Daniel que generen nuevas features futuras (ver Escenario E) — pero eso es un efecto derivado posible, no una dependencia formal que bloquee ninguna feature existente hoy.

## Impacto

**Archivos del repo modificados (al ejecutar la feature, no al especificarla):**

- `docs/postmortems/2026-07-20-openmemory-ui-rce.md` — los 3 marcadores `[CONFIRMAR CON EMILIO]` reemplazados por respuestas fechadas y atribuidas (o por su variante "no se puede determinar"), y el banner inicial actualizado si ambos puntos quedan resueltos.

**Archivos del repo NO modificados (explícito):**

- `DEPLOY_COOLIFY.md` — sin cambios. Ya referencia el postmortem por link; no repite ninguno de sus marcadores, así que no necesita edición cuando estos se resuelvan.
- Cualquier código de `gateway/`, `memory/` o `metrics-hub/` — esta feature es puramente documental, no toca configuración ni código de ningún servicio.
- Ningún archivo nuevo. En particular, no se crea un documento paralelo de "respuestas de Emilio" (ver INV-5 de `1_spec.md`) — la única fuente de verdad sigue siendo el propio postmortem.

**Fuera del repo (no versionado en git):**

- El mensaje enviado a Emilio y su respuesta viven en el canal de comunicación real que se use (Slack, WhatsApp, llamada, email) — esta spec no asume ni fija cuál. El repo solo registra el resultado final (las respuestas ya incorporadas al postmortem), no la transcripción de la conversación misma.

## Notas de Implementación

No hay work item de Plane asociado (`plane_workitem_id: null`). Se invocó `plane-sync list-pending-tasks` como parte de la creación de esta spec: el proyecto `VINF` (`project_id: ca75c562-081c-4236-904d-b403484dcf7d`) sigue sin ningún work item (`workitem action=list` devolvió `total_count: 0`, igual que al crear las tres specs anteriores de este sprint). La feature viene directamente del backlog (`vision/backlog.md`, Sprint 1 — Cierre de gaps operativos post-incidente), donde ya estaba listada como pendiente antes de correr este workflow.

Hallazgo adicional durante esa misma consulta: la llamada `workitem action=list` con filtro `pql: 'state = "<uuid>"'` (el patrón que `VisionFramework/skills/plane-sync.md` documenta como no confirmado) falló con un error explícito del servidor MCP — *"PQL and structured filters are not supported on this Plane edition"* — no un error de sintaxis del filtro en sí, sino que esta edición de Plane no soporta PQL en absoluto sobre `workitem list`. Este es exactamente el gap que la spec hermana `verify-plane-sync-end-to-end` (ya en este mismo sprint) existe para diagnosticar y corregir. No se toca aquí — se deja anotado como evidencia real adicional para esa spec, obtenida incidentalmente al crear esta.

> Supuesto: se asume que el canal de contacto con Emilio (Slack, WhatsApp, llamada, email) es el que Daniel normalmente usa para hablar con él en el día a día. Esta spec no fija un canal específico porque este repo no tiene ninguna integración de mensajería configurada (confirmado en `port-exposure-alerts/0_contract.md`: "no hay ningún webhook ni integración de notificaciones configurada hoy"). El mensaje redactado en `1_spec.md` está escrito para funcionar igual de bien por texto (Slack/WhatsApp/email) que como guión para una llamada.
