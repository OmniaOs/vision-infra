# Plan de Testing: Confirmar alcance del incidente con Emilio

## Metadata

```yaml
test_framework: ninguno (validación manual)
version: 1
last_updated: 2026-08-27
```

## Estrategia de Testing

No hay test en el sentido de software para esta feature. No hay código que ejecutar, ni servidor que levantar, ni respuesta HTTP que inspeccionar — a diferencia incluso de `expose-metrics-hub-domain` (que al menos valida con `curl` un comportamiento de red real). El "objeto bajo prueba" de esta feature es un documento markdown editado a mano después de una conversación humana, así que "testearlo" significa releerlo con atención y correr un par de comandos de bajo riesgo (`grep`, `git diff`) que confirman mecánicamente lo que la lectura ya debería haber mostrado.

Esta feature tampoco tiene una fase de "ejecución automatizable seguida de verificación automatizable", como sí la tienen `port-exposure-alerts` (script + fixture Docker) o incluso `verify-plane-sync-end-to-end` (llamadas MCP reales). Aquí la única "ejecución" es la conversación con Emilio (`1_spec.md` → Algoritmo → Pasos 1-2), que por definición no es algo que este plan de testing pueda disparar ni simular — solo puede verificar su **resultado** una vez que ya ocurrió.

Si en algún momento este repo adopta un linter de documentación que, por ejemplo, falle un check de CI si detecta el string `[CONFIRMAR CON` en cualquier archivo bajo `docs/postmortems/` más allá de una fecha límite, ese trabajo sería una feature aparte (una suerte de "verificador de deuda de postmortems pendientes") — no está en el alcance de esta spec.

## Validación Manual

Ejecutar en este orden, después de que el Paso 3 (y, si aplica, el Paso 4) del Algoritmo de `1_spec.md` estén completos — es decir, después de que el postmortem ya fue editado con las respuestas reales de Emilio.

### Paso 1 — Ningún marcador original sobrevive (cubre AC-004)

```bash
grep -n "CONFIRMAR CON EMILIO" docs/postmortems/2026-07-20-openmemory-ui-rce.md
```

**Esperado:** sin resultados (exit code 1 de `grep`, que indica "no match"). Si el comando devuelve al menos una línea, la feature no está lista — falta resolver ese marcador específico.

### Paso 2 — Los 3 marcadores de confirmación están presentes con el formato correcto (cubre AC-001, AC-002, AC-003, AC-005)

```bash
grep -n "CONFIRMADO POR EMILIO" docs/postmortems/2026-07-20-openmemory-ui-rce.md
```

**Esperado:** exactamente 3 líneas (una por cada uno de Q1, Q2, Q3), cada una siguiendo el patrón `[CONFIRMADO POR EMILIO — YYYY-MM-DD` con una fecha real (revisar visualmente que no quedó el literal `YYYY-MM-DD` sin sustituir — un `grep -n "YYYY-MM-DD"` sobre el mismo archivo debería devolver cero resultados como chequeo cruzado).

```bash
grep -n "YYYY-MM-DD" docs/postmortems/2026-07-20-openmemory-ui-rce.md
```

**Esperado:** sin resultados — confirma que ningún placeholder de fecha quedó sin reemplazar.

### Paso 3 — Lectura completa de las 3 respuestas (cubre AC-006, AC-007, AC-009)

Inspección manual, no un comando: abrir `docs/postmortems/2026-07-20-openmemory-ui-rce.md` y leer cada una de las 3 secciones editadas (Impacto, Causa raíz, Lecciones) de punta a punta.

Confirmar para cada una:

- El texto tiene sentido como respuesta real a la pregunta correspondiente (no es una paráfrasis vaga del marcador original, ni repite la incertidumbre que ya expresaba el texto pre-existente).
- Si la respuesta es "no se puede determinar", incluye la razón dada por Emilio, no solo la etiqueta (AC-006).
- Si la respuesta contradice lo que el texto decía antes, la afirmación vieja ya no está presente en ningún lado del párrafo — comparar contra el texto original citado en `0_contract.md` → Propósito, o contra `git show HEAD~N:docs/postmortems/2026-07-20-openmemory-ui-rce.md` si hace falta ver la versión previa exacta (AC-007).
- Quien revisa puede recordar o señalar cómo llegó a esa respuesta (el mensaje enviado, la fecha, el canal) — no simplemente "confío en que está bien" (AC-009). Este punto no tiene comando de verificación; es responsabilidad de quien cierra la feature poder responder afirmativamente si se le pregunta.

### Paso 4 — El diff está acotado al alcance esperado (cubre AC-008, AC-011)

```bash
git diff --stat -- docs/postmortems/2026-07-20-openmemory-ui-rce.md
git diff -- .
```

**Esperado:**
- El primer comando muestra cambios únicamente en `docs/postmortems/2026-07-20-openmemory-ui-rce.md` (más, si corresponde, `vision/vision-status.json` al marcar la feature como `in-progress`/`done` — eso es parte del ciclo de vida del framework, no del contenido de la feature en sí).
- El segundo comando (diff completo del repo) no muestra ningún archivo nuevo tipo `EMILIO-ANSWERS.md` o similar, ni cambios en `DEPLOY_COOLIFY.md`, `gateway/`, `memory/` o `metrics-hub/`.
- Dentro del diff de `docs/postmortems/2026-07-20-openmemory-ui-rce.md`, las líneas modificadas se concentran en los 3 marcadores (y opcionalmente el banner inicial) — no hay reescritura de "Resumen", "Resolución" ni del resto del documento.

### Paso 5 — El banner refleja el estado correcto (cubre AC-012)

Inspección manual: leer las primeras líneas del archivo (el bloque `> **Estado: ...**`).

**Esperado:**
- Si las 3 preguntas quedaron resueltas (Paso 1 y Paso 2 de esta validación ya pasaron): el banner dice `Estado: confirmado por Emilio el YYYY-MM-DD` (con fecha real), no `Estado: borrador reconstruido`.
- Si alguna de las 3 sigue pendiente (no debería llegar a este punto del plan de testing si es así, ver Paso 1): el banner debe seguir diciendo `Estado: borrador reconstruido` — actualizarlo antes de tiempo sería un falso positivo.

### Paso 6 — El estado de la feature en el framework es consistente (cubre AC-010)

```bash
grep -A3 '"name": "confirm-incident-scope-with-emilio"' vision/vision-status.json
```

**Esperado:** el campo `status` es `"done"` únicamente si los Pasos 1-5 de esta validación ya pasaron todos. Si algún paso anterior falló (marcador sin resolver, placeholder de fecha sin sustituir, diff fuera de alcance), el `status` no debe ser `"done"` — revisar que no se haya marcado la feature como completa prematuramente.

## Helpers y Fixtures

No aplica. No hay fixtures de datos, no hay entorno que levantar, no hay credenciales que generar. El único "insumo" externo a este repo es la conversación real con Emilio (`1_spec.md` → Algoritmo → Pasos 1-2), que por su naturaleza no puede tener un fixture — no hay forma de simular una respuesta humana real sin vaciar de sentido el propósito de la feature (ver INV-1 de `1_spec.md`).

## Comandos de Ejecución

No hay un comando único tipo `npm test`. La validación es la secuencia de los Pasos 1 a 6 de "Validación Manual", en orden, ejecutada **después** de que el postmortem ya fue editado con respuestas reales — nunca antes, y nunca como sustituto de tener esas respuestas.

## Resumen de Tests

| Paso | Cubre | Tipo |
|---|---|---|
| 1 | AC-004 | grep |
| 2 | AC-001, AC-002, AC-003, AC-005 | grep (x2) |
| 3 | AC-006, AC-007, AC-009 | inspección manual + `git show` opcional |
| 4 | AC-008, AC-011 | git diff |
| 5 | AC-012 | inspección manual |
| 6 | AC-010 | grep sobre `vision-status.json` |

Total: 6 pasos, cubriendo los 12 criterios de aceptación de `2_acceptance-criteria.md` (varios pasos cubren más de un AC a la vez, dado que varios criterios comparten la misma evidencia observable). La feature se considera lista para `/onspecomplete` solo cuando los 6 pasos pasan — con el Paso 3 (AC-009, la atestación de que la conversación ocurrió de verdad) como el más importante de todos: es el único que ningún comando puede verificar por sí solo, y es exactamente el que distingue a esta feature de un ejercicio de completar un archivo con texto plausible.
