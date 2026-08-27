# Especificación Técnica: Confirmar alcance del incidente con Emilio

## Metadata

```yaml
status: pending
version: 1
last_updated: 2026-08-27
category: docs
```

## Historial de Cambios

- [ADDED] 2026-08-27: Versión inicial de la especificación.

Esta es la versión 1 de esta spec — sin cambios posteriores todavía. Si Emilio revela algo que amplía el alcance original (Escenario F de `0_contract.md`), esa ampliación se documenta como una nueva versión vía `/modifyspec`, no editando esta versión en el lugar.

## Naturaleza de Este Documento

Este documento **no describe código ni configuración de infraestructura**. A diferencia de `1_spec.md` de `expose-metrics-hub-domain` (que describe un runbook de consola) o de `port-exposure-alerts` (que describe un script real), aquí no hay nada que un agente pueda ejecutar de punta a punta por su cuenta. Se mantiene la estructura estándar del documento (invariantes, algoritmo, manejo de errores) porque sigue siendo útil como referencia precisa de qué hacer y qué verificar, pero:

- **"Stack Técnico"** no aplica — no hay stack, hay una conversación.
- **"Modelo de Datos"** no es un modelo de aplicación — es la estructura mínima para llevar registro de las 3 preguntas y sus respuestas (ver más abajo).
- **"Algoritmo"** es literalmente un guión de conversación con un mensaje ya redactado, no pseudocódigo de una función.
- **"Manejo de Errores"** cubre situaciones humanas (no responde, no se acuerda, contradice el texto existente) en vez de códigos de salida o respuestas HTTP.

Quien ejecute `/executespec confirm-incident-scope-with-emilio` debe leer el Paso 1 del Algoritmo, enviar el mensaje tal como está (o adaptado mínimamente al canal real), y luego **detenerse a esperar una respuesta humana real** antes de tocar el postmortem. No hay forma correcta de "simular" este paso.

## Invariantes

- **INV-1**: Ningún marcador `[CONFIRMAR CON EMILIO]` se reemplaza sin una respuesta real de Emilio — nunca con una inferencia razonable en su lugar. Eso ya se hizo una vez, al escribir el postmortem original a partir solo del historial de git; es exactamente lo que esta feature existe para cerrar, no para repetir.
- **INV-2**: Todo reemplazo de marcador queda etiquetado con procedencia y fecha real de confirmación, formato `[CONFIRMADO POR EMILIO — YYYY-MM-DD]`. La fecha es la de la respuesta real de Emilio, no la de creación de esta spec (2026-08-27) ni la de ejecución de `/executespec`, salvo que ambas coincidan genuinamente.
- **INV-3**: Si una pregunta no puede responderse ni siquiera por Emilio (p. ej., los logs de Qdrant/OpenMemory de la ventana del 20 al 24-jul ya no existen), el marcador se reemplaza por la variante explícita `[CONFIRMADO POR EMILIO — YYYY-MM-DD: no se puede determinar, <razón>]` — nunca se deja el marcador `[CONFIRMAR CON EMILIO]` original, y nunca se borra la pregunta sin dejar registro de que se preguntó y de por qué no tiene respuesta.
- **INV-4**: Las 3 preguntas que se le hacen a Emilio (Paso 1 del Algoritmo) son exactamente las que ya están ancladas al texto existente del postmortem (ver las tres citas literales en `0_contract.md` → Propósito) — esta spec no inventa preguntas nuevas no derivadas del documento.
- **INV-5**: El único archivo de contenido que cambia como resultado de ejecutar esta feature es `docs/postmortems/2026-07-20-openmemory-ui-rce.md`. No se crea un documento paralelo de "respuestas de Emilio" que fragmente la fuente de verdad del incidente.
- **INV-6**: Ningún agente marca esta feature `done` (vía `/onspecomplete`) sin evidencia de que la conversación con Emilio ocurrió realmente. El criterio de cierre en `2_acceptance-criteria.md` exige poder señalar el mensaje efectivamente enviado y la respuesta efectivamente recibida — no solo el archivo ya editado.
- **INV-7**: Si la respuesta de Emilio **contradice** (no solo completa) una afirmación ya escrita en el postmortem, el texto contradicho se corrige explícitamente. No se limita a agregar el marcador de confirmación al lado de una afirmación que ahora se sabe incorrecta — ver Escenario D de `0_contract.md`.

Estas siete invariantes son la referencia contra la que se valida cada AC de `2_acceptance-criteria.md`.

## Stack Técnico

No aplica. No hay lenguaje, framework, ni dependencia de software involucrada en el núcleo de esta feature — el "medio" es el canal de comunicación que Daniel use normalmente con Emilio (ver Supuesto en `0_contract.md`), y la "herramienta" es un editor de texto para actualizar el postmortem una vez llegue la respuesta.

## Modelo de Datos

No hay un modelo de datos de aplicación. Lo más cercano es la estructura mínima para llevar registro de cada una de las 3 preguntas y su estado de resolución — útil como checklist, no como esquema ejecutable:

```yaml
# Estructura de seguimiento de cada uno de los 3 puntos abiertos.
# No es un modelo de datos de runtime — es la forma de razonar y
# documentar cada respuesta antes de editar el postmortem.
pregunta:
  id: Q1 | Q2 | Q3
  marcador_original: >
    El texto literal `[CONFIRMAR CON EMILIO]` tal como aparece hoy en el
    postmortem, en la sección correspondiente (ver Algoritmo → Paso 0 para
    la cita exacta y la ubicación de cada uno).
  pregunta_enviada: >
    La pregunta concreta tal como se le plantea a Emilio (ver Algoritmo →
    Paso 1, mensaje completo, preguntas 1, 2 y 3).
  estado_resultante: CONFIRMADO | CONFIRMADO_DESCONOCIDO | PENDIENTE
  marcador_final: >
    Si CONFIRMADO: `[CONFIRMADO POR EMILIO — YYYY-MM-DD]` seguido de la
    respuesta real, reemplazando el texto original si lo contradice (INV-7).
    Si CONFIRMADO_DESCONOCIDO: `[CONFIRMADO POR EMILIO — YYYY-MM-DD: no se
    puede determinar, <razón>]` (INV-3).
    Si PENDIENTE: el marcador original permanece sin tocar — la feature no
    está lista para cerrar mientras exista al menos un Q en este estado.
```

Las tres preguntas reales (`Q1`, `Q2`, `Q3`) están fijadas en el Paso 0 del Algoritmo — no son un placeholder genérico, son exactamente los tres puntos citados en `0_contract.md` → Propósito.

## Algoritmo

### Paso 0 — Ubicar los 3 marcadores en el postmortem

Los tres puntos a resolver, con su ubicación exacta en `docs/postmortems/2026-07-20-openmemory-ui-rce.md`:

**Q1 — sección "Impacto"**, bajo el encabezado "Alcance real de la explotación":

```
- **Alcance real de la explotación** — **[CONFIRMAR CON EMILIO]**: no hay
  registro local de qué se ejecutó, si se leyeron/exfiltraron datos de la
  memoria compartida (Qdrant/`mem0_store`), o si el atacante pivoteó a otros
  contenedores del stack.
```

**Q2 — sección "Causa raíz"**, en el párrafo que sigue a los dos factores de causa raíz:

```
**Cómo se detectó** — **[CONFIRMAR CON EMILIO]**: no hay registro de si fue
monitoreo activo, un scan externo reportado, o hallazgo directo del
atacante notado por comportamiento anómalo.
```

**Q3 — sección "Lecciones / acciones de seguimiento"**, tercer ítem de la lista:

```
- **Abierto — [CONFIRMAR CON EMILIO].** Reconstruir, aunque sea
  aproximadamente, si hubo acceso/exfiltración real de datos de memoria
  durante la ventana de exposición, revisando logs de Qdrant/OpenMemory si
  todavía existen.
```

Nótese que Q3 es, en la práctica, el mismo tema de fondo que Q1 (acceso/exfiltración de datos) pero encuadrado como una acción a intentar ("revisar logs si existen") en vez de como una afirmación de lo que se sabe. Se tratan como dos marcadores separados porque el postmortem los escribió en dos lugares distintos con dos formulaciones distintas — y porque la respuesta puede diverger: es posible que Emilio confirme el alcance real de memoria (Q1) sin que los logs sigan existiendo para revisarlos (Q3), o viceversa.

### Paso 1 — Enviar el mensaje a Emilio

Mensaje completo, listo para copiar y enviar (adaptar el saludo si el canal real es una llamada en vez de texto):

```
Hola Emilio — estoy cerrando los puntos que quedaron abiertos en el
postmortem que reconstruí del incidente de openmemory-ui (expuesta sin
auth del 20 al 24 de julio, vos lo arreglaste en el commit 82cba23). Lo
reconstruí solo del historial de git porque no había un postmortem escrito
en su momento, así que hay 3 cosas marcadas [CONFIRMAR CON EMILIO] que solo
vos podés responder. Doc completo acá:
docs/postmortems/2026-07-20-openmemory-ui-rce.md

Si tenés 10-15 minutos:

1. Alcance real — ¿llegaste a confirmar si durante esos ~4 días se leyó o
   exfiltró algo de la memoria compartida (Qdrant/mem0_store, OpenMemory)?
   ¿O fue "solo" superficie expuesta sin evidencia de que alguien haya
   accedido a datos?

2. Detección — ¿cómo te enteraste de que openmemory-ui estaba expuesta?
   ¿Monitoreo activo, algo que te reportaron desde afuera, o algo raro que
   notaste vos mismo?

3. Logs — ¿todavía existen logs de Qdrant/OpenMemory de esa ventana (20 al
   24 de julio) que se puedan revisar para responder el punto 1 con más
   certeza, o ya se rotaron/perdieron?

Cualquier respuesta sirve, incluido un "no tengo cómo saberlo" en
cualquiera de las tres — la idea es cerrar el documento con la realidad,
no dejarlo con TODOs colgados indefinidamente. Gracias.
```

Notas sobre este mensaje:

- Las tres preguntas están numeradas 1-a-1 con Q1/Q2/Q3 del Paso 0 — no hay una cuarta pregunta ni una quinta, deliberadamente (INV-4, y el respeto por el tiempo de Emilio citado en las User Stories de `0_contract.md`).
- El mensaje ofrece explícitamente "no tengo cómo saberlo" como respuesta válida — esto es intencional: reduce la fricción de responder y previene que Emilio invente una respuesta más segura de la que realmente tiene solo por sentirse obligado a dar una.
- El link al archivo usa una ruta relativa al repo (`docs/postmortems/...`) asumiendo que Emilio tiene acceso al repo — si el canal real no soporta que abra el archivo directamente (p. ej. una llamada), puede ser necesario pegar el contenido relevante o compartir pantalla.

### Paso 2 — Esperar la respuesta

No es un paso automatizable. El tiempo de respuesta puede ir de minutos (si es una llamada o un chat en vivo) a varios días (si es un mensaje asíncrono y Emilio está ocupado con otra cosa). Esta spec no define un SLA ni un mecanismo de recordatorio automático — ver Escenario C de `0_contract.md`.

### Paso 3 — Editar el postmortem con cada respuesta

Para cada una de las 3 preguntas, una vez respondida, reemplazar el marcador correspondiente. Patrón genérico (ilustrado sobre Q1; Q2 y Q3 siguen la misma forma):

```diff
- **Alcance real de la explotación** — **[CONFIRMAR CON EMILIO]**: no hay
- registro local de qué se ejecutó, si se leyeron/exfiltraron datos de la
- memoria compartida (Qdrant/`mem0_store`), o si el atacante pivoteó a otros
- contenedores del stack.
+ **Alcance real de la explotación** — **[CONFIRMADO POR EMILIO —
+ YYYY-MM-DD]**: <respuesta real de Emilio, reemplazando este placeholder
+ con el texto efectivo — no una paráfrasis genérica>.
```

Si la respuesta es "no se puede determinar" (Escenario B de `0_contract.md`):

```diff
- **Alcance real de la explotación** — **[CONFIRMAR CON EMILIO]**: no hay
- registro local de qué se ejecutó, si se leyeron/exfiltraron datos de la
- memoria compartida (Qdrant/`mem0_store`), o si el atacante pivoteó a otros
- contenedores del stack.
+ **Alcance real de la explotación** — **[CONFIRMADO POR EMILIO —
+ YYYY-MM-DD: no se puede determinar]**: Emilio confirmó que no hay forma de
+ saberlo con certeza — <razón dada, ej. "los logs de esa ventana ya se
+ rotaron antes de que se pensara en revisarlos">. Se documenta como límite
+ conocido, no como pendiente.
```

Si la respuesta **contradice** el texto existente (Escenario D, INV-7), el reemplazo no es aditivo — el texto incorrecto desaparece, no queda al lado del nuevo:

```diff
- **Cómo se detectó** — **[CONFIRMAR CON EMILIO]**: no hay registro de si fue
- monitoreo activo, un scan externo reportado, o hallazgo directo del
- atacante notado por comportamiento anómalo.
+ **Cómo se detectó** — **[CONFIRMADO POR EMILIO — YYYY-MM-DD]**:
+ <descripción real de cómo se detectó, según la respuesta de Emilio — si
+ contradice la premisa "no hay registro" del texto original, esa premisa
+ se elimina, no se conserva junto a la respuesta correcta>.
```

### Paso 4 — Actualizar el banner inicial (condicional)

Si las 3 preguntas quedan resueltas (con respuesta real o "no se puede determinar" — no si alguna sigue `PENDIENTE`), actualizar el banner de apertura del documento para que deje de decir "borrador reconstruido" cuando eso ya dejó de ser el estado real:

```diff
- > **Estado: borrador reconstruido el 2026-08-26.** No existía ningún
- > postmortem escrito — solo el commit del fix. Los campos marcados
- > **[CONFIRMAR CON EMILIO]** son inferencias razonables a partir del código y
- > el commit, no hechos verificados de primera mano. Este documento es
- > blameless: el objetivo es la línea de tiempo y las acciones, no
- > responsabilidad individual.
+ > **Estado: confirmado por Emilio el YYYY-MM-DD.** Reconstruido
+ > inicialmente el 2026-08-26 a partir del historial de git — no existía un
+ > postmortem escrito en su momento. Los 3 puntos marcados
+ > `[CONFIRMAR CON EMILIO]` fueron confirmados directamente con él (ver el
+ > detalle y la fecha exacta de cada confirmación en su sección
+ > correspondiente). Este documento es blameless: el objetivo es la línea de
+ > tiempo y las acciones, no responsabilidad individual.
```

Si alguna de las 3 preguntas queda en `PENDIENTE` (Emilio no respondió esa parte), el banner **no** se actualiza — sigue diciendo "borrador reconstruido" porque eso sigue siendo parcialmente cierto, y actualizarlo antes de tiempo ocultaría que todavía falta una respuesta.

### Paso 5 — Verificar que no queda ningún marcador sin resolver

```bash
grep -n "CONFIRMAR CON EMILIO" docs/postmortems/2026-07-20-openmemory-ui-rce.md
```

Esperado: sin resultados. Si el comando devuelve al menos una línea, la feature no está lista para `/onspecomplete` — ver `3_test-plan.md` para el detalle de esta validación.

## Manejo de Errores

No hay códigos de salida ni respuestas HTTP — esta tabla cubre situaciones humanas y de proceso que pueden surgir al ejecutar el Algoritmo:

| Situación | Escenario | Comportamiento esperado | Acción |
|---|---|---|---|
| Emilio no responde en un tiempo razonable | Mensaje enviado, sin respuesta tras varios días | La feature permanece bloqueada (`in-progress` o `pending`, nunca `done`) | No forzar el cierre. Reenviar, escalar por otro canal, o decidir cuánto esperar es decisión de Daniel — fuera del alcance mecánico de esta spec (Escenario C de `0_contract.md`). |
| Emilio responde "no me acuerdo" / "no hay forma de saberlo" | Pregunta genuinamente sin respuesta disponible para él también | Se marca `CONFIRMADO_DESCONOCIDO` (INV-3), nunca se deja el marcador `[CONFIRMAR CON EMILIO]` original | Documentar tal cual, incluyendo la razón dada (Paso 3, variante "no se puede determinar"). |
| La respuesta contradice el texto ya escrito | Ej.: el postmortem asume "no hay registro" pero Emilio sí recuerda algo distinto | El texto contradicho se corrige, no solo se etiqueta al lado (INV-7) | Reemplazar la afirmación incorrecta por la correcta — ver la tercera variante del Paso 3. |
| Se documenta la respuesta en un lugar distinto al postmortem | Alguien registra la respuesta en Slack, en un archivo nuevo, o en un comentario de PR en vez de editar `docs/postmortems/2026-07-20-openmemory-ui-rce.md` | Viola INV-5 — la fuente de verdad del incidente se fragmenta | Mover la respuesta al postmortem real; el otro lugar no cuenta como "documentado" a efectos de esta feature. |
| Se marca la feature `done` sin conversación real | Un agente (o una persona apurada) completa el archivo con una inferencia razonable en vez de esperar a Emilio | Viola INV-1 y INV-6 — exactamente el patrón que esta feature existe para evitar | No cerrar la feature. Si ya se editó el archivo sin respuesta real, revertir esa edición y volver al Paso 1. |
| Se resuelven Q1/Q2/Q3 pero se agrega una cuarta pregunta no anticipada | Emilio menciona algo fuera de las 3 preguntas originales (Escenario F) | No es un error, pero tampoco forma parte del criterio de cierre de esta feature | Documentar el hallazgo adicional si amerita (nueva nota en el postmortem, o backlog item aparte); no bloquear el cierre de Q1-Q3 por esto. |

## Resumen Ejecutivo

Checklist de implementación (a ejecutar por quien tenga el canal de contacto con Emilio, presumiblemente Daniel):

- [ ] Enviar el mensaje del Paso 1 a Emilio por el canal habitual (Slack, WhatsApp, llamada, email — el que ya usen).
- [ ] Esperar respuesta real a las 3 preguntas (Paso 2) — sin forzar plazos ni simular una respuesta.
- [ ] Para cada pregunta respondida, editar el postmortem reemplazando su marcador (Paso 3), incluyendo el caso "no se puede determinar" si aplica.
- [ ] Si las 3 quedaron resueltas, actualizar el banner inicial del postmortem (Paso 4).
- [ ] Correr el `grep` de verificación (Paso 5): 0 ocurrencias de `CONFIRMAR CON EMILIO` restantes.
- [ ] Confirmar que ningún otro archivo del repo cambió como efecto de esta feature (`git diff --stat` limitado a `docs/postmortems/2026-07-20-openmemory-ui-rce.md`).
- [ ] Correr `/onspecomplete confirm-incident-scope-with-emilio` **solo** si el grep del Paso 5 confirma cero marcadores pendientes y hay evidencia real (mensaje enviado + respuesta recibida) de que la conversación ocurrió.

Nota final: esta checklist no se puede completar en una sola sesión de agente sin intervención humana en el medio — el Paso 2 es, por diseño, un punto de espera real. Cualquier ejecución de `/executespec` sobre esta feature que llegue al Paso 1 y no pueda avanzar más allá debe reportarse como "bloqueada esperando respuesta de Emilio", no como fallida ni como completa.
