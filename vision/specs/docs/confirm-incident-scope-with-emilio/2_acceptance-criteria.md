# Criterios de Aceptación: Confirmar alcance del incidente con Emilio

## Metadata

```yaml
feature: confirm-incident-scope-with-emilio
version: 1
last_updated: 2026-08-27
```

## Resumen Ejecutivo

Total de criterios: **12**, agrupados en 4 categorías:

1. Resolución de cada marcador (AC-001 a AC-004)
2. Procedencia y disciplina de registro (AC-005 a AC-007)
3. Integridad del proceso — la conversación ocurrió de verdad (AC-008 a AC-010)
4. Alcance del documento (AC-011 a AC-012)

Todos los criterios se verifican manualmente (lectura del archivo + `grep` + `git diff`) — ver `3_test-plan.md`. No hay ningún criterio verificable por un comando que ejecute comportamiento de software, porque esta feature no produce comportamiento de software.

---

## 1. Resolución de cada marcador

### AC-001: El marcador de "Alcance real de la explotación" (Q1) queda resuelto

**Given** el postmortem contiene hoy el marcador `[CONFIRMAR CON EMILIO]` en la sección "Impacto", bajo "Alcance real de la explotación",
**When** Emilio responde la pregunta 1 del mensaje enviado (`1_spec.md` → Algoritmo → Paso 1),
**Then** ese marcador se reemplaza por `[CONFIRMADO POR EMILIO — YYYY-MM-DD]` seguido de la respuesta real (o de la variante "no se puede determinar" si aplica, ver AC-006), sin dejar el texto `[CONFIRMAR CON EMILIO]` en esa sección.

### AC-002: El marcador de "Cómo se detectó" (Q2) queda resuelto

**Given** el postmortem contiene hoy el marcador `[CONFIRMAR CON EMILIO]` en la sección "Causa raíz", bajo "Cómo se detectó",
**When** Emilio responde la pregunta 2 del mensaje enviado,
**Then** ese marcador se reemplaza siguiendo el mismo patrón que AC-001, específico a la pregunta de detección.

### AC-003: El ítem abierto de "Lecciones / acciones de seguimiento" (Q3) queda resuelto

**Given** el ítem "Abierto — [CONFIRMAR CON EMILIO]" en la sección "Lecciones / acciones de seguimiento", sobre reconstruir acceso/exfiltración vía logs de Qdrant/OpenMemory,
**When** Emilio responde la pregunta 3 del mensaje enviado (si los logs de esa ventana todavía existen y qué revelan),
**Then** el ítem deja de estar marcado como `Abierto — [CONFIRMAR CON EMILIO]` y pasa a reflejar el resultado real: o bien qué se encontró al revisar los logs, o bien que los logs ya no existen y por qué no se pudo revisar nada.

### AC-004: Ningún marcador `[CONFIRMAR CON EMILIO]` sobrevive en el archivo

**Given** los 3 puntos (AC-001, AC-002, AC-003) fueron atendidos,
**When** se ejecuta `grep -n "CONFIRMAR CON EMILIO" docs/postmortems/2026-07-20-openmemory-ui-rce.md`,
**Then** el comando no devuelve ningún resultado.

---

## 2. Procedencia y disciplina de registro

### AC-005: Cada respuesta lleva fecha real y atribución explícita

**Given** cada uno de los 3 marcadores reemplazados,
**When** se inspecciona el texto resultante,
**Then** contiene el patrón `[CONFIRMADO POR EMILIO — YYYY-MM-DD]` con una fecha real de la confirmación (no un placeholder tipo `YYYY-MM-DD` sin sustituir, ni una fecha inventada que no corresponda al momento real en que Emilio respondió).

### AC-006: Las respuestas "no se puede determinar" quedan explícitas, no como TODO silencioso

**Given** una de las 3 preguntas que Emilio no puede responder con certeza (p. ej. porque los logs relevantes ya no existen),
**When** se documenta esa respuesta en el postmortem,
**Then** el texto usa explícitamente la variante `[CONFIRMADO POR EMILIO — YYYY-MM-DD: no se puede determinar, <razón>]` con la razón real dada por Emilio — nunca se deja el campo vacío, nunca se infiere una respuesta más certera de la que él realmente dio.

### AC-007: El texto contradicho se corrige, no se etiqueta encima

**Given** una respuesta de Emilio que contradice (no solo completa) una afirmación ya escrita en el postmortem,
**When** se edita el documento con esa respuesta,
**Then** el texto incorrecto original desaparece del documento — no queda la afirmación errónea al lado del nuevo marcador de confirmación como si ambas fueran igualmente válidas.

---

## 3. Integridad del proceso — la conversación ocurrió de verdad

### AC-008: No se crea un documento paralelo de respuestas

**Given** las respuestas de Emilio a las 3 preguntas,
**When** se revisa qué archivos del repo cambiaron como parte de esta feature,
**Then** el único archivo con contenido de las respuestas es `docs/postmortems/2026-07-20-openmemory-ui-rce.md` — no existe un `EMILIO-ANSWERS.md`, ni una sección nueva en `DEPLOY_COOLIFY.md` u otro archivo, con las mismas respuestas duplicadas.

### AC-009: La conversación con Emilio ocurrió realmente, no fue simulada por un agente

**Given** el cierre de esta feature,
**When** se audita cómo se obtuvieron las 3 respuestas,
**Then** quien cierra la feature puede señalar el mensaje efectivamente enviado (canal + fecha aproximada) y la respuesta efectivamente recibida de Emilio — no hay ninguna respuesta "inferida razonablemente" por un agente en su lugar. Este criterio no es verificable por un comando; es una atestación humana explícita, y su ausencia invalida el cierre de la feature aunque el archivo esté editado con el formato correcto (ver INV-1 e INV-6 de `1_spec.md`).

### AC-010: Si Emilio no respondió, la feature no se marca `done`

**Given** que alguna de las 3 preguntas sigue sin respuesta real de Emilio,
**When** se revisa el estado de la feature en `vision-status.json`,
**Then** el estado sigue siendo `in-progress` o `pending` — nunca `done`, sin importar cuánto tiempo haya pasado desde que se envió el mensaje.

---

## 4. Alcance del documento

### AC-011: El resto del postmortem no cambia de forma no relacionada

**Given** que el alcance de esta feature son únicamente los 3 marcadores (más, condicionalmente, el banner inicial),
**When** se compara `docs/postmortems/2026-07-20-openmemory-ui-rce.md` antes y después de implementar esta feature (`git diff`),
**Then** el diff se limita a esas ediciones — no hay reescritura de secciones no relacionadas ("Resumen", "Resolución", "Causa raíz" más allá del punto de detección, etc.).

### AC-012: El banner inicial se actualiza si y solo si las 3 preguntas quedaron resueltas

**Given** el banner de apertura del postmortem ("Estado: borrador reconstruido el 2026-08-26..."),
**When** se revisa tras completar (o intentar completar) esta feature,
**Then** el banner refleja el nuevo estado (`Estado: confirmado por Emilio el YYYY-MM-DD`, ver `1_spec.md` → Algoritmo → Paso 4) únicamente si los 3 marcadores quedaron resueltos (con respuesta real o "no se puede determinar"). Si alguno de los 3 sigue `PENDIENTE`, el banner permanece sin cambios — sigue diciendo "borrador reconstruido" porque eso sigue siendo cierto.

---

## Cobertura del Contrato

| Sección del contrato (`0_contract.md`) | ACs que la cubren |
|---|---|
| Escenario A (happy path) | AC-001, AC-002, AC-003, AC-004, AC-005 |
| Escenario B (respuesta "no se puede saber") | AC-006 |
| Escenario C (Emilio no responde) | AC-010 |
| Escenario D (respuesta contradice el texto) | AC-007 |
| Escenario E (exfiltración confirmada) | AC-001, AC-005 (se documenta igual que cualquier otra respuesta; las acciones derivadas quedan fuera de alcance, ver "No incluye") |
| Escenario F (pregunta nueva no anticipada) | No bloquea ningún AC de este set — ver "Alcance → No incluye" del contrato |
| Alcance → Incluye: mensaje listo para enviar | Verificado en `1_spec.md`, no tiene AC propio (es un artefacto de la spec, no del resultado de ejecutarla) |
| Alcance → No incluye: documento paralelo | AC-008 |
| Invariante INV-1/INV-6 (sin inferencia de agente) | AC-009 |
| Invariante INV-2 (procedencia y fecha) | AC-005 |
| Invariante INV-3 ("no se puede determinar" explícito) | AC-006 |
| Invariante INV-5 (única fuente de verdad) | AC-008 |
| Invariante INV-7 (corrección, no etiquetado encima) | AC-007 |

## Notas

- Esta es la primera spec del repo cuyo criterio de cierre más importante (AC-009) **no es verificable por ningún comando**. Es, deliberadamente, un criterio de atestación humana — quien marque esta feature como completa debe poder responder "sí, hablé con Emilio, esto es lo que dijo" con datos concretos (fecha, canal), no solo mostrar el diff del archivo.
- No hay criterios sobre "tiempo de respuesta" ni "SLA" — a diferencia de `port-exposure-alerts` (donde el tiempo hasta detectar una regresión es el punto central de la feature), aquí no hay ninguna expectativa de plazo impuesta a Emilio.
- AC-004 (grep de verificación) es el criterio más mecánico y el más fácil de automatizar como paso de doble chequeo, pero no reemplaza a AC-009 — un archivo sin marcadores `[CONFIRMAR CON EMILIO]` no es evidencia por sí sola de que las respuestas sean reales y no inventadas.
- Ningún criterio de este set depende de acceso a Coolify, al MCP de Plane, ni al VPS — a diferencia de las otras tres specs de este sprint, la única dependencia externa de esta feature es la disponibilidad de una persona.

## Definición de "Hecho" para esta feature

Esta feature se considera completa (lista para cerrar con `/onspecomplete confirm-incident-scope-with-emilio`) únicamente cuando se cumplen **todas** las siguientes condiciones simultáneamente:

1. Los 12 criterios de aceptación (AC-001 a AC-012) se verifican contra el estado real de `docs/postmortems/2026-07-20-openmemory-ui-rce.md` en el repo, no contra una versión hipotética o borrador local sin commitear.
2. El grep de AC-004 confirma cero ocurrencias de `CONFIRMAR CON EMILIO` en el archivo.
3. Existe evidencia real y señalable (AC-009) de que la conversación con Emilio ocurrió — no una inferencia de un agente actuando en su lugar.
4. Si alguna de las 3 preguntas terminó en "no se puede determinar" (AC-006), eso se acepta como cierre válido de esa pregunta específica — no bloquea el cierre general de la feature, siempre que esté documentado con la misma disciplina que una respuesta positiva.

Si Emilio nunca responde (Escenario C), esta feature **permanece abierta indefinidamente** — no hay una fecha de vencimiento después de la cual se pueda cerrar por decisión unilateral de quien la ejecuta. Eso sería, otra vez, el mismo patrón que esta feature existe para evitar: completar con inferencia lo que solo una persona específica puede confirmar.

Quien ejecute `/onspecomplete` sobre esta feature debe poder mostrar, para cada uno de los 3 marcadores, el texto real que quedó en el postmortem — no una descripción de memoria de "ya se lo pregunté" — y debe poder mostrar cómo se enteró de la respuesta (screenshot del mensaje, cita del chat, o al menos la fecha y el canal de la llamada si fue verbal).
