---
name: newspec
description: 'Crea la spec completa de una feature (4 archivos) en modo express por defecto: 2 preguntas obligatorias, todo lo demás se infiere del constitution + Plane + exploración del proyecto. El flag --deep activa el modo legacy de 8 rondas con preview por ronda.'
---

# /newspec — Crear Spec de una Feature

Eres un agente ejecutando el workflow `/newspec` de Vision V2. Tu tarea es producir la spec completa de **una** feature (4 archivos markdown) y dejar el backlog y `vision-status.json` actualizados.

Sigue estas instrucciones en orden estricto. Toda tu interacción con el usuario es en español. Todo el contenido que generes en los 4 archivos también es en español.

## Propósito

Por cada invocación de `/newspec` produces 4 archivos obligatorios bajo `vision/specs/<categoria>/<feature-name>/`:

- `0_contract.md` — contrato de alto nivel
- `1_spec.md` — especificación técnica con ejemplos de código, snippets y pseudocódigo
- `2_acceptance-criteria.md` — criterios AC-### en Given-When-Then
- `3_test-plan.md` — plan de testing (tests si es código; validación manual si es workflow/skill)

Además actualizas:

- `vision/backlog.md`: agregas el ítem de la feature al sprint elegido por el usuario.
- `vision/vision-status.json`: agregas un entry nuevo con `status: pending`.

## Argumentos

`/newspec` no acepta argumentos posicionales. Solo acepta un **flag opcional**:

| Flag | Modo |
|---|---|
| (ninguno) | **Modo express** (default): 2 preguntas obligatorias, hasta 3 preguntas dirigidas si hay lagunas críticas, todo lo demás se infiere |
| `--deep` | **Modo deep** (legacy): 8 rondas formales con preview por ronda |

Otros flags reconocidos en cualquier modo:

- Bloque de texto largo (> 200 chars) o ruta a archivo en el mensaje de invocación → tratado como **documento prellenado**. Su contenido se mapea semánticamente y se salta lo que ya está cubierto.

## Selección de Modo

### Paso 0 — Detectar modo

Inspecciona el mensaje del usuario al invocar el workflow:

1. Si contiene literalmente la palabra `--deep` (cualquier capitalización) → **modo deep**. Salta a la sección "Modo Deep — Algoritmo".
2. En cualquier otro caso → **modo express**. Salta a la sección "Modo Express — Algoritmo".

## Prerequisitos (comunes)

Antes de cualquier otra acción:

1. Verifica que existe `vision/constitution.md`. Si no, aborta con:
   ```
   No encuentro vision/constitution.md. Corre `vision init` primero.
   ```
2. Verifica que existe `vision/backlog.md`. Si no, aborta con:
   ```
   No encuentro vision/backlog.md. Corre `vision init` y `/setup` primero.
   ```
3. Lee `vision/constitution.md`, `vision/backlog.md` y `vision/vision-status.json` en memoria. Guarda snapshots para rollback.

## Skills Invocadas (comunes)

Este workflow invoca tres skills del framework:

- **`skill-read-constitution`**: al inicio de ambos modos, para obtener las secciones H2 del constitution como contexto del proyecto y leer el bloque `plane:` si existe.
- **`skill-find-related-specs`**: tras obtener una descripción inicial y de nuevo con el nombre final, para detectar similitud con specs existentes.
- **`plane-sync list-pending-tasks`**: en modo express, antes de la Pregunta 1, si Plane está habilitado en el constitution. En modo deep, en el Paso 5 si aplica.

Invoca cada skill siguiendo la convención de tu IDE (`/<skill> <args>`, `@<skill> <args>`, etc.). El output es texto markdown que inyectas a tu contexto. No dupliques la lógica de esas skills aquí.

---

## Modo Express — Algoritmo

El modo express es el default. Su contrato es: **2 preguntas obligatorias** al usuario, hasta **3 preguntas dirigidas adicionales** solo si hay lagunas críticas, y todo lo demás se infiere de:

- El constitution (stack, convenciones, módulos existentes).
- La estructura actual de `vision/specs/`.
- La descripción del work item de Plane (si la feature viene de ahí).
- La exploración profunda del proyecto.
- `find-related-specs`.

### Paso E1 — Detectar prellenado

Si el mensaje de invocación contiene un bloque de texto largo (> 200 caracteres) con estructura clara, una ruta a archivo, o un folder con docs → trátalo como prellenado. Mapea semánticamente al contenido de los 4 archivos. Documenta en memoria un mapa `prefilled = { <seccion>: <texto> }`.

### Paso E2 — Invocar skills de contexto

1. Invoca `skill-read-constitution`. Guarda secciones H2 y, si existe, el bloque `plane:` parseado.
2. Lista los subdirectorios directos de `vision/specs/`. Estas son las categorías existentes.
3. Enumera las specs ya escritas dentro de cada categoría (solo nombres de carpeta).

### Paso E3 — Listar work items de Plane pendientes (si aplica)

Si el bloque `plane:` del constitution tiene `enabled: true`:

1. Invoca `plane-sync list-pending-tasks`.
2. Guarda la lista de work items pendientes (identifier, name, description) en memoria. Si el output es un caso especial de no-op (MCP ausente, lista vacía, etc.), continúa sin lista — la integración degrada silenciosamente.

### Paso E4 — Pregunta 1: Origen de la feature

Muestra al usuario:

```
**Pregunta 1/2:** ¿De dónde viene esta feature?

a) [Si hay work items pendientes en Plane] Work item de Plane:
   1. <identifier> — <name>
   2. <identifier> — <name>
   ...

b) Pendiente del backlog sin spec aún:
   1. <feature-name>
   2. <feature-name>
   ...

c) Una idea nueva — descríbela en 1-2 párrafos.

Tu respuesta:
```

Si no hay work items pendientes en Plane ni backlog sin spec, omite las opciones vacías y pide la descripción libre.

Procesa la respuesta:

- Si elige un work item de Plane → guarda `plane_workitem_id` (el identificador humano, ej. `ENG-42`), y usa `name + description` como **descripción inicial** de la feature.
- Si elige un item del backlog → usa el nombre del backlog como **nombre tentativo** y pide al agente inferir la descripción del contexto (constitution + nombre).
- Si responde con texto libre → usa ese texto como **descripción inicial**.

### Paso E5 — Exploración profunda del proyecto

Sin tope de archivos, siguiendo la priorización de la sección "Exploración del Proyecto". Construye contexto mental del repo: stack, convenciones, módulos existentes, features implícitas. Esta exploración es obligatoria también en modo express; lo único que se elimina son las rondas formales de preguntas.

### Paso E6 — Inferir nombre y categoría

Aplica las mismas reglas de la sección "Propuesta de Nombre y Categoría" pero **sin preguntar**:

1. Si la feature viene del backlog, el nombre ya está fijado.
2. Si viene de Plane o de descripción libre, infiere un nombre kebab-case con la heurística estándar (sustantivos principales, convención observada, vocabulario del constitution).
3. Infiere la categoría según el tipo (comando del framework → `commands/`, skill → `skills/`, módulo interno → `core/`, UI → `ui/`, API → `api/`, datos → `data/`).

Las inferencias del nombre y la categoría se documentan en el preview global final y el usuario puede corregirlas ahí.

### Paso E7 — Invocar `find-related-specs`

Con el nombre inferido. Si el top resultado tiene `relevance ≥ 0.70`, **detecta laguna crítica**: pregunta una vez si es feature nueva o prefiere `/modifyspec` la existente. Cuenta contra el tope de 3 preguntas dirigidas.

### Paso E8 — Generar los 4 archivos en memoria

Con el contexto reunido (constitution + estructura + work item de Plane + descripción + exploración + specs relacionadas + prellenado), genera los 4 archivos completos. Sigue las plantillas de la sección "Generación de los 4 Archivos" y respeta la profundidad mínima.

Para cada sección que falte fuente:

- Infiere desde el constitution si describe arquitectura coherente.
- Infiere desde patrones del proyecto si la exploración los detectó.
- Si infieres por necesidad, anótalo en una línea al final del archivo correspondiente como `> Supuesto: <descripción>` para que el usuario lo audite en el preview.
- **No hagas preguntas** para padding o detalles secundarios.

### Paso E9 — Detección de lagunas críticas

Antes de mostrar el preview, evalúa si hay lagunas críticas que invaliden la spec:

| Laguna crítica | Disparador | Pregunta dirigida |
|---|---|---|
| Descripción inicial muy corta | < 50 caracteres y no viene de Plane con description | "La descripción es muy escueta. ¿Puedes ampliar qué resuelve la feature y para quién?" |
| Categoría no inferible con confianza | Constitution no describe arquitectura clara y la feature no encaja en ninguna categoría existente con score > 0.5 | "No puedo inferir la categoría con confianza. ¿La pongo en `<opt1>`, `<opt2>` o creas una nueva?" |
| Sin escenarios negativos | El contrato generado tiene 0 escenarios de error | "No detecté escenarios de error en lo que describiste. ¿Qué pasa si X falla, es cancelado o tiene input inválido?" |
| Spec relacionada con relevance ≥ 0.70 (Paso E7) | Ver Paso E7 | Ver Paso E7 |

Tope absoluto: **3 preguntas dirigidas**. Si llegas al tope y aún quedan lagunas, sigue con tus mejores inferencias y márcalo como `> Supuesto: ...` en el archivo afectado.

### Paso E10 — Pregunta 2: Sprint del backlog

Muestra al usuario:

```
**Pregunta 2/2:** ¿A qué sprint añado "<feature-name>"?

a) Sprint actual (Sprint <N> — <nombre>).
b) Sprint específico:
   1. Sprint <N> — <nombre>
   2. Sprint <N> — <nombre>
   ...
c) Crear un nuevo sprint: <propón un nombre descriptivo>.

Tu respuesta:
```

Guarda la decisión.

### Paso E11 — Preview global final

Muestra los 4 archivos completos + cambios planificados a `backlog.md` y `vision-status.json`:

```
### Preview global

— vision/specs/<categoria>/<feature-name>/0_contract.md —
[contenido completo, incluyendo plane_workitem_id en frontmatter si aplica]

— vision/specs/<categoria>/<feature-name>/1_spec.md —
[contenido completo]

— vision/specs/<categoria>/<feature-name>/2_acceptance-criteria.md —
[contenido completo]

— vision/specs/<categoria>/<feature-name>/3_test-plan.md —
[contenido completo]

— Actualización a vision/backlog.md —
En Sprint <N> — <nombre>, agregar:
- [ ] **<feature-name>** — `vision/specs/<categoria>/<feature-name>/`

— Actualización a vision/vision-status.json —
Agregar entry con status: pending, position: <N+1>.

Supuestos detectados (si los hay): [lista de líneas `> Supuesto: ...`]
Inferencias clave: nombre → <X>, categoría → <Y>, fuente → <Plane/backlog/idea libre>.

¿Escribir todo? (sí / editar <seccion> / cancelar)
```

Si el usuario responde `editar <seccion>`, re-genera ese fragmento, hazle al usuario hasta una pregunta dirigida si es necesaria, y vuelve a mostrar el preview. No vuelvas a las dos preguntas iniciales (esas ya están confirmadas).

### Paso E12 — Escritura atómica

Igual que el Paso 10 del modo deep. Ver sección "Escritura Atómica".

---

## Modo Deep — Algoritmo

Modo legacy. 8 rondas formales con preview por ronda. Idéntico al comportamiento histórico de `/newspec` previo a la introducción del modo express.

### Paso D1 — Detectar archivo de respuestas prellenadas

Inspecciona el mensaje con el que el usuario invocó `/newspec`:

- Si contiene un bloque de texto largo (> 200 caracteres) con estructura clara (headings, listas, YAML, JSON, pares clave:valor) → trátalo como **documento prellenado**.
- Si menciona una ruta de archivo (relativa o absoluta) → léela.
- Si menciona un folder → lista archivos `.md`/`.yml`/`.json` relevantes bajo ese folder y léelos.
- Si no hay nada → procede sin prellenado.

Si hay prellenado, mapea semánticamente su contenido a las preguntas de las 8 rondas. Guarda un mapa interno `prefilled = { <ronda/subsección>: <respuesta> }`.

### Paso D2 — Invocar skills de contexto

1. Invoca `skill-read-constitution`. Usa las secciones retornadas como contexto durante todo el flujo.
2. Lista los subdirectorios directos de `vision/specs/`.
3. Enumera las specs ya existentes dentro de cada categoría.

### Paso D3 — Exploración profunda del proyecto

Siguiendo las reglas de la sección "Exploración del Proyecto". Sin tope de archivos.

### Paso D4 — Primera interacción: elegir o describir la feature

Muestra al usuario:

```
Detecté estas features pendientes en el backlog:

1. feature-a
2. feature-b
3. feature-c
...

Si Plane está configurado, también:
[lista de work items pendientes en Plane]

Opciones:
a) Elegir una del backlog (número).
b) Elegir un work item de Plane.
c) Describir una idea nueva que aún no está en el backlog.
d) Cancelar.
```

Extrae una **descripción inicial** de la elección o la descripción libre del usuario. Si elige un work item de Plane, guarda `plane_workitem_id` (el identificador humano, ej. `ENG-42`).

### Paso D5 — Invocar `find-related-specs`

Con el nombre tentativo (si viene del backlog) o los tokens más relevantes de la descripción. Si el top resultado tiene relevance ≥ 0.70, advierte:

```
Detecté alta similitud con la spec existente "<nombre>" (relevance 0.XX).
¿Es realmente una feature nueva o prefieres modificar la existente con /modifyspec?
```

### Paso D6 — Ejecutar Rondas 1 a 7

Para cada ronda en orden:

1. Si la ronda está completamente cubierta por `prefilled` → genera el fragmento desde el prellenado. El preview lleva la etiqueta `[Tomado del documento aportado]`.
2. Si está parcialmente cubierta → formula solo las preguntas faltantes.
3. Si no está cubierta → formula todas las preguntas de la ronda.
4. Aplica detección de lagunas antes de cerrar la ronda.
5. Muestra el preview de la ronda.
6. Espera confirmación: `sí` / `editar <subsección>` / `saltar <subsección>` / `cancelar`.
7. Si cancela → rollback (nada escrito), termina con mensaje de cancelación.

### Paso D7 — Ronda 8: Ubicación en el Backlog

Pregunta a qué sprint añadir la feature (actual / específico / nuevo).

### Paso D8 — Preview global final

Muestra los 4 archivos completos + los cambios planificados a `backlog.md` y `vision-status.json`. Pide confirmación única (`sí` / `cancelar`).

### Paso D9 — Escritura atómica

Ver sección "Escritura Atómica".

---

## Exploración del Proyecto

### Exclusiones automáticas (nunca leas)

`node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `.nuxt/`, `target/`, `vendor/`, `__pycache__/`, `.venv/`, `venv/`, `.tox/`, `coverage/`, `.cache/`, `.turbo/`, `out/`, `.DS_Store`, archivos `.min.js`, `.min.css`.

### Priorización (este orden)

1. `vision/specs/**/0_contract.md`
2. `vision/constitution.md` (ya cubierto vía skill)
3. `README*`, `CHANGELOG*`, `ARCHITECTURE*`, `CONTRIBUTING*`, `docs/**`, `doc/**`
4. Configs: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `tsconfig.json`, `.nvmrc`, `Dockerfile`, `docker-compose.yml`, `.editorconfig`, `.eslintrc*`, `.prettierrc*`
5. Imágenes: `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.svg`, `*.webp` — léelas visualmente (capacidad multimodal)
6. Código fuente: `src/`, `app/`, `lib/`, `packages/**`, `apps/**`

### Sin tope

Lee todo lo necesario. En repos grandes prioriza niveles 1-4 antes del código masivo.

### Documentos y folders aportados por el usuario durante el flujo

Si durante cualquier ronda (o en cualquier respuesta del modo express) el usuario pega texto, referencia una ruta, menciona un folder o adjunta imágenes → léelos inmediatamente e intégralos al contexto.

## Lectura de Constitution y Estructura

- Invoca `skill-read-constitution` al inicio para obtener las secciones H2 del constitution. Úsalas para inferir stack coherente, convenciones y módulos existentes.
- Lista los subdirectorios directos de `vision/specs/`. Las categorías detectadas son las candidatas principales.
- Si el constitution describe estructura de carpetas del proyecto, úsala como pista adicional para la categoría.

## Archivo de Respuestas Prellenadas

### Detección

Al iniciar el flujo, inspecciona el mensaje del usuario. Es un documento prellenado si:

- Contiene un bloque de texto > ~200 caracteres con estructura clara.
- Referencia una ruta de archivo existente.
- Menciona un folder con documentación.

### Extracción semántica

Mapea el contenido del documento a las preguntas. No requiere schema rígido: Markdown, YAML, JSON, texto libre — todos válidos. Interpreta semánticamente.

### Preguntas saltadas

Las preguntas cuyas respuestas están en el prellenado se saltan. El preview de esa subsección lleva la etiqueta `[Tomado del documento aportado]`.

### Ambigüedades

Si el documento es vago, contradictorio o incompleto, pregunta al usuario para clarificar. **Nunca infieras en silencio cuando el usuario aportó información explícita.** (En modo express puedes inferir cuando el usuario **no** aportó información.)

## Propuesta de Nombre y Categoría

### Nombre

Infiere un nombre kebab-case basado en:

- Palabras clave de la descripción (sustantivos principales).
- Convención observada en `vision/specs/`.
- Coherencia con vocabulario del constitution.

En modo deep, presenta al usuario propuesta + 3 alternativas y pide elegir.
En modo express, propones el nombre y lo dejas en el preview global para que el usuario lo edite si quiere.

Validación: el nombre final debe cumplir `^[a-z0-9-]+$` y no existir ya bajo `vision/specs/`.

### Categoría

Tras elegir nombre, infiere la categoría según:

- Comando del framework (empieza con `vision-` o es slash command) → `commands/`.
- Skill del framework → `skills/`.
- Módulo interno de bajo nivel → `core/`.
- UI, frontend, componente visual → `ui/`.
- API o endpoint backend → `api/`.
- Procesamiento de datos → `data/`.
- Si ninguna encaja → propón crear nueva categoría.

En modo deep, presenta opciones y pide confirmación.
En modo express, eliges directamente y la dejas para edición en el preview global.

## Rondas (modo deep)

### Ronda 1 — Contexto y Propósito

Preguntas:

- ¿Qué es la feature en una oración?
- ¿Para quién es? (perfiles de usuario)
- ¿Qué problema resuelve?
- ¿Hay alguna referencia visual o mockup? (pide imagen si aplica)

Output: base para `0_contract.md` — secciones User Stories + Propósito.

### Ronda 2 — Identificación y Ubicación

Pasos:

- Propón nombre (con 3 alternativas).
- Usuario acepta / elige alternativa / propone otro.
- Propón categoría (con alternativas existentes + opción de nueva).
- Usuario confirma.

Output: path final `vision/specs/<categoria>/<feature>/`.

### Ronda 3 — Alcance y Escenarios

Preguntas:

- ¿Qué incluye la feature? (listar)
- ¿Qué NO incluye? (exclusiones explícitas)
- Escenarios (happy path + errores + cancelación + edge cases)

Output: base para `0_contract.md` — secciones Alcance + Escenarios.

### Ronda 4 — Dependencias e Impacto

Pasos:

1. Invoca `find-related-specs` con el nombre final.
2. Muestra el top 5 como sugerencias de dependencias.
3. Pregunta: ¿cuáles son dependencias reales? ¿cuáles features serán bloqueadas por esta?
4. Pregunta: ¿qué archivos se crean / modifican?

Output: base para `0_contract.md` — secciones Dependencias + Impacto.

### Ronda 5 — Especificación Técnica

Preguntas agrupadas:

- **Invariantes no negociables** (INV-1, INV-2…). Infiere 5+ del tipo de feature y pide confirmar/añadir.
- **Stack técnico** específico de esta feature.
- **Modelo de datos**: propón interfaces TypeScript (u otro lenguaje) en bloques fenced.
- **Algoritmo**: pasos numerados con ejemplos de código, snippets, pseudocódigo.
- **Manejo de errores**: tabla (Código | Escenario | Mensaje | Exit Code).

Output: `1_spec.md` completo.

### Ronda 6 — Criterios de Aceptación

Pasos:

1. Deriva un set inicial de criterios AC-### en Given-When-Then.
2. Agrupa por categorías temáticas.
3. Muestra al usuario y pregunta si agregar, eliminar o modificar.
4. Mínimo 10 criterios para features no triviales.

Output: `2_acceptance-criteria.md` completo.

### Ronda 7 — Plan de Testing

Pasos:

1. Propón estrategia según el tipo (código TS/JS → vitest; workflow/skill markdown → validación manual).
2. Lista casos de test con `describe/it` o lista manual.
3. Identifica helpers y fixtures necesarios.
4. Da comandos de ejecución.

Output: `3_test-plan.md` completo.

### Ronda 8 — Ubicación en el Backlog

Pregunta a qué sprint añadir la feature (actual / específico / nuevo).

## Formato de Pregunta (modo deep y modo express)

Canónico:

```
**Pregunta:** <texto>

Sugerencias (elige una o responde libre):
a) <sugerencia 1>
b) <sugerencia 2>
c) <sugerencia 3>

Tu respuesta:
```

En modo express, las preguntas tienen el prefijo `Pregunta 1/2:` y `Pregunta 2/2:` para que el usuario sepa cuántas le quedan.

## Detección de Lagunas (modo deep)

Antes de cerrar cada ronda, evalúa completitud. Heurísticas:

| Laguna | Señal | Pregunta dirigida |
|---|---|---|
| Descripción corta | User stories < 2 o propósito < 30 palabras | "¿Qué otras perspectivas debería cubrir esta feature?" |
| Escenarios incompletos | Solo happy path | "¿Qué pasa si X falla / es cancelado / tiene input inválido?" |
| Dependencias implícitas | `find-related-specs` devuelve relevance ≥ 0.70 no mencionadas | "Detecté alta similitud con X. ¿Es dependencia?" |
| Sub-features implícitas | Dominio típico implica otras (ej. login → recovery) | "Usualmente un X implica también Y, Z. ¿Incluir, separar, u omitir?" |
| Criterios insuficientes | AC derivados < 10 en feature no trivial | "El set de ACs está delgado. ¿Añado criterios de A, B, C?" |
| Algoritmo sin detalle | Pasos < 3 o sin ejemplos de código | "¿Puedo proponer pseudocódigo / snippets detallados?" |

**Nunca inferas en silencio cuando el usuario aportó información explícita.** Si hay laguna en lo que el usuario dijo, pregunta. (En modo express, inferir está permitido cuando el usuario **no** dijo nada al respecto, anotándolo como `> Supuesto`.)

## Preview por Ronda y Preview Global

### Preview por ronda (solo modo deep)

```
### Preview — Ronda N: <nombre>

<fragmento que se incorporará al archivo correspondiente>

Este fragmento va a: <archivo>

¿Confirmas? (sí / editar <subsección> / saltar <subsección> / cancelar)
```

### Preview global final (ambos modos)

Tras todas las rondas (deep) o tras la generación inicial (express), antes de escribir, muestra los 4 archivos completos + cambios a `backlog.md` y `vision-status.json`. Pide confirmación única.

## Generación de los 4 Archivos

### Plantilla de `0_contract.md`

Secciones H2 en este orden:

1. Título H1: `# Feature: <Nombre con espacios>`
2. `## Metadata` (YAML con `status: pending`, `created: YYYY-MM-DD`, `updated: YYYY-MM-DD`, `dependencies: ...`, `position: N`, `plane_workitem_id: <identificador o null>`)
3. `## User Stories` (formato `**Como** X **Quiero** Y **Para** Z`, mínimo 2)
4. `## Naturaleza del Artefacto` (si es workflow/skill/template)
5. `## Propósito`
6. `## Escenarios` (si aplica; A, B, C…)
7. `## Alcance` con `### Incluye:` y `### No incluye:`
8. `## Dependencias` con subsecciones `### Esta feature depende de:` y `### Esta feature es requerida por:`
9. `## Impacto`
10. `## Notas de Implementación` (opcional; si la feature viene de Plane, incluye el identificador del work item)

### Plantilla de `1_spec.md`

1. `# Especificación Técnica: <Nombre>`
2. `## Metadata` (status, version: 1, last_updated)
3. `## Historial de Cambios` con `- [ADDED] YYYY-MM-DD: ...`
4. `## Tipo de Artefacto` o `## Naturaleza de Este Documento`
5. `## Invariantes` (INV-1, INV-2…, mínimo 5 para features no triviales)
6. `## Stack Técnico` (si aplica)
7. `## Modelo de Datos` con interfaces en bloques fenced
8. `## Algoritmo` con pasos numerados e incluyendo ejemplos de código, snippets, pseudocódigo
9. `## Manejo de Errores` con tabla (Código | Escenario | Mensaje | Exit Code)
10. `## Resumen Ejecutivo` con checklist de implementación

### Plantilla de `2_acceptance-criteria.md`

1. `# Criterios de Aceptación: <Nombre>`
2. `## Metadata` (feature, version, last_updated)
3. `## Resumen Ejecutivo` (total de criterios, categorías)
4. Categorías numeradas con criterios `### AC-###: <título>` en Given-When-Then.
5. `## Cobertura del Contrato` (tabla que mapea secciones del contrato a ACs).
6. `## Notas`

### Plantilla de `3_test-plan.md`

1. `# Plan de Testing: <Nombre>`
2. `## Metadata` (test_framework si aplica, version, last_updated)
3. `## Estrategia de Testing`
4. `## Tests Unitarios` (si código) o `## Validación Manual` (si workflow/skill)
5. `## Tests de Integración` (si código)
6. `## Helpers y Fixtures`
7. `## Comandos de Ejecución`
8. `## Resumen de Tests`

### Profundidad mínima esperada

- `0_contract.md` ≥ 100 líneas (features no triviales: ≥ 200)
- `1_spec.md` ≥ 200 líneas
- `2_acceptance-criteria.md` ≥ 10 criterios y ≥ 150 líneas
- `3_test-plan.md` ≥ 80 líneas

En modo deep, si algún preview resulta por debajo del mínimo, detecta laguna y pregunta. En modo express, completa con inferencias del constitution + patrones del proyecto, anotando supuestos.

## Actualización de Backlog y vision-status

### Backlog

1. Lee `vision/backlog.md`.
2. Identifica todos los sprints H2 (`## Sprint N — ...`).
3. Según la elección del usuario en Pregunta 2 (express) o Ronda 8 (deep):
   - `a) sprint actual`: inserta el ítem en el último sprint con features pendientes.
   - `b) sprint específico`: inserta en el sprint nombrado.
   - `c) nuevo sprint`: agrega `## Sprint <N+1> — <nombre descriptivo>` al final y mete el ítem ahí.
4. Formato del ítem:
   ```
   - [ ] **<feature-name>** — `vision/specs/<categoria>/<feature-name>/`
   ```
5. Preserva el resto del backlog intacto.

### vision-status.json

1. Lee `vision/vision-status.json`.
2. Calcula `position = max(specs[*].position) + 1`.
3. Agrega al array `specs`:
   ```json
   {
     "name": "<feature-name>",
     "status": "pending",
     "completedAt": null,
     "position": <N>
   }
   ```
4. Actualiza `lastUpdated` a la fecha ISO 8601 actual.

## Escritura Atómica

- Construye todo el contenido en memoria.
- No escribas nada a disco hasta que el preview global sea confirmado.
- Si el usuario cancela antes de la confirmación global → descarta todo, nada escrito.
- Si cualquier escritura falla tras la confirmación:
  1. Elimina los archivos ya creados en `vision/specs/<categoria>/<feature>/`.
  2. Si el directorio quedó vacío, elimínalo.
  3. Si la categoría era nueva y quedó vacía, elimínala.
  4. Restaura `backlog.md` y `vision-status.json` desde los snapshots leídos en Prerequisitos.
  5. Reporta el error al usuario con detalle.

### Mensaje final al escribir exitosamente

```
Spec lista en vision/specs/<categoria>/<feature-name>/.
- 0_contract.md (X líneas)
- 1_spec.md (Y líneas)
- 2_acceptance-criteria.md (Z líneas, N criterios)
- 3_test-plan.md (W líneas)

Backlog actualizado en Sprint <N> — <nombre>. vision-status.json sincronizado.

[Si vino de Plane]
Asociada a work item de Plane: <plane_workitem_id>

Próximo paso:
- Para implementar: corre /executespec <feature-name>.
- Para crear otra feature: corre /newspec de nuevo.
```

### Mensaje al cancelar

```
/newspec cancelado. No se modificó ningún archivo.
```

### Mensaje al error con rollback exitoso

```
Hubo un error al escribir: <detalle>. Hice rollback completo: todos los archivos están como antes.
```

## Casos Especiales

| Escenario | Acción |
|---|---|
| Sin `vision/` | Abortar, indicar `vision init` |
| Sin constitution o backlog | Abortar, indicar `vision init` y `/setup` |
| Feature ya existe con 4 archivos completos | Sugerir `/modifyspec` |
| Feature existe con archivos parciales | Preguntar: completar faltantes o rehacer todo |
| Archivo prellenado inaccesible | Avisar al usuario, continuar sin él |
| Archivo prellenado contradictorio | Pedir clarificación |
| Respuesta incoherente del usuario | Pedir clarificación, no inferir en silencio |
| `find-related-specs` devuelve relevance ≥ 0.70 | Avisar al usuario y sugerir `/modifyspec` |
| Cancelación | Rollback, nada escrito |
| Falla escritura final | Rollback total |
| Plane no disponible o `enabled: false` | Continuar sin lista de work items; modo express usa solo backlog + idea libre en Pregunta 1 |

## Resumen de Invariantes

- Siempre en español.
- No aceptas argumentos posicionales. Solo el flag `--deep`.
- Modo express por defecto; 2 preguntas obligatorias + máximo 3 dirigidas.
- Modo deep activado con `--deep`; 8 rondas con preview por ronda.
- Tú propones el nombre; el usuario lo confirma o edita en el preview global.
- Tú infieres la categoría leyendo la estructura de `vision/specs/`.
- Exploración profunda obligatoria antes de cualquier modo.
- Detección de lagunas explícita en deep; selectiva (solo críticas) en express.
- Escritura atómica al final; rollback completo si algo falla.
- `1_spec.md` contiene ejemplos de código, snippets y pseudocódigo.
- Los 4 archivos cumplen la profundidad mínima.
- `find-related-specs`, `read-constitution` y `plane-sync` se invocan como skills externas; no duplicas su lógica.
- Si la feature viene de un work item de Plane, el `0_contract.md` lleva `plane_workitem_id` en el frontmatter.
