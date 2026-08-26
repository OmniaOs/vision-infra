---
name: setup
description: 'Primer pass tras vision init: llena vision/constitution.md con contexto de alto nivel y genera vision/backlog.md con sprints y features enumeradas. Al terminar instruye correr /newspec para crear cada spec detallada.'
---

# /setup — Primer pass del proyecto

Eres un agente ejecutando el workflow `/setup` de Vision V2. Tu tarea es capturar el contexto de alto nivel del proyecto y producir un backlog inicial por sprints, para dejar todo listo antes de que el usuario corra `/newspec` por cada feature.

Sigue estas instrucciones en orden estricto. Toda tu interacción con el usuario es en español. El contenido que escribas en los archivos también es en español.

## Propósito

Llenas `vision/constitution.md` con contexto de alto nivel del proyecto (descripción, stack, arquitectura, convenciones) preservando la sección `## Módulos Implementados`, y generas `vision/backlog.md` con una distribución inicial de features por sprints.

Eres un **primer pass** rápido. No haces exploración exhaustiva del repo, ni rondas por tema con 3 sugerencias excluyentes + preview por ronda, ni generas archivos de spec por feature. Esa complejidad vive en `/newspec`, no aquí.

## Prerequisitos

Antes de cualquier otra acción:

1. Verifica que existe `vision/constitution.md`. Si no, aborta con:
   ```
   No encuentro vision/constitution.md. Corre `vision init` primero.
   ```
2. Verifica que existe `vision/backlog.md`. Si no, aborta con:
   ```
   No encuentro vision/backlog.md. Corre `vision init` primero.
   ```
3. Lee el contenido completo de ambos archivos en memoria. Guárdalos como snapshots para rollback si la escritura final falla.

## Algoritmo

### Paso 1 — Detectar contenido previo

Comprueba si `vision/constitution.md` tiene contenido real más allá de los placeholders `[...]` del template. Si sí, pregunta una sola vez:

> Ya hay contenido en `constitution.md`. ¿Quieres rehacerlo? (sí / no)

- Si `no`: termina con el mensaje `Ok, no toqué nada. Si quieres agregar features, corre /newspec.` y no modifiques archivos.
- Si `sí`: continúa.

Si no hay contenido real previo, continúa directamente.

### Paso 2 — Lectura rápida de fuentes externas

Lee solo lo siguiente (nada más, no hagas exploración exhaustiva):

- `README*` de la raíz, si existe.
- `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `tsconfig.json` de la raíz, si existen.

No leas código fuente, no leas carpetas anidadas, no leas imágenes. Esas exploraciones son trabajo de `/newspec`.

### Paso 3 — Preguntas directas

Formula estas preguntas en orden. Puedes proponer una respuesta inferida de las lecturas del Paso 2 y pedir confirmación simple (sí / no / otro). **No uses el formato `a) b) c)` de 3 sugerencias excluyentes** — ese formato es de `/newspec`, no de aquí.

1. **Nombre del proyecto** (kebab-case). Propuesta: `package.json.name` si existe, o el nombre del directorio.
2. **Descripción en una oración**.
3. **Tipo del proyecto**: web app / API / CLI / librería / extensión / otro.
4. **Stack técnico principal**: lenguajes, frameworks, base de datos, testing.
5. **Arquitectura en una frase**: estilo (monolito, microservicios, modular, hexagonal, etc.).
6. **Convenciones clave** (naming, estructura, manejo de errores) — breve.
7. **Listado de features principales del proyecto**: pide al usuario enumerarlas separadas por comas o saltos de línea.

La pregunta sobre la integración con Plane **no** va aquí; vive en el Paso 4.5 porque requiere acceso a herramientas MCP que no son parte del cuestionario base.

Si al inicio el usuario pega un README detallado o un bloque de texto grande, úsalo como respuesta global y salta las preguntas específicas que ya estén cubiertas.

### Paso 4 — Construir contenido en memoria

Construye el texto completo de `vision/constitution.md`:

- Reemplaza los placeholders del template con las respuestas.
- **Preserva la sección `## Módulos Implementados` del snapshot original** (o restaura el placeholder del template si no existía). Esta sección no la tocas tú; es responsabilidad de `/onspecomplete`.
- **Preserva el bloque `## Integración Plane`** del snapshot original si ya existía con `enabled: true`. Si no existía, lo dejas con la plantilla por defecto (`enabled: false`) — el Paso 4.5 lo sobrescribe si el usuario decide habilitar la integración.

Construye el texto completo de `vision/backlog.md`:

- Mantén la cabecera (bloque de variables HTML, `# Backlog:`, `## Metadata`, sección `## Sobre este backlog`).
- Reemplaza el marker `<!-- BACKLOG_EMPTY: true ... -->` por los sprints y sus features.

### Paso 4.5 — Configuración opcional de Plane

Pregunta una sola vez:

> ¿Quieres conectar este proyecto con Plane para que los work items se sincronicen automáticamente con el ciclo de vida de las features (pending → in-progress → done)? (sí / no)

- Si responde `no` → el bloque `plane:` queda con `enabled: false`. Salta al Paso 5.
- Si responde `sí` → ejecuta los subpasos siguientes.

#### Paso 4.5.a — Verificar disponibilidad del MCP de Plane

Comprueba si las herramientas MCP `workitem` y `state` (del servidor `plane`) están disponibles. A diferencia de ClickUp, el MCP de Plane no prefija sus herramientas por integración — despacha operaciones internamente vía un parámetro `action` sobre herramientas por recurso (`workitem`, `state`, `project`, `workitem_property`, …). Si **no** están disponibles:

> El MCP de Plane no está conectado en este IDE. Salté la configuración. Cuando lo conectes, vuelve a correr `/setup` para configurar la integración.

Marca `plane.enabled = false` y salta al Paso 5.

#### Paso 4.5.b — Descubrir proyecto

El servidor MCP de Plane ya tiene fijado su workspace (vía la variable de entorno `PLANE_WORKSPACE_SLUG` de su propia configuración), así que no hay que descubrir workspace como en ClickUp — solo el **proyecto** dentro de ese workspace.

1. Llama a la herramienta MCP `project` con `action: "list"`. Es de solo lectura y no requiere parámetros obligatorios (acepta `cursor`, `per_page`, `order_by` opcionales). Cada resultado incluye al menos `id` (UUID) y `name`, y normalmente `identifier` (el prefijo corto usado en los identificadores humanos de work items, ej. `ENG` en `ENG-42`).
2. Si la llamada tiene éxito y devuelve proyectos, muéstralos numerados al usuario:
   ```
   1. <name> (<identifier>) — id: <id>
   2. ...
   ```
   Pregunta: `¿En qué proyecto viven los work items de este repo? (número)`. Guarda su `id` como `project_id`.
3. Si la herramienta `project` **no está disponible**, o la llamada falla, o no puedes confirmar con certeza el resultado: no inventes una herramienta ni un id. Pide directamente:
   > Pega el `project_id` de tu proyecto en Plane (lo ves en la URL del proyecto dentro de `management.omniaos.ai`, o pídeselo a quien administra el workspace).
   Usa el valor que el usuario pegue como `project_id`, sin más validación que "no está vacío".

#### Paso 4.5.c — Mapear status

1. Llama a `state` con `action: "list"` y el `project_id` elegido. Lee el array de estados disponibles.
2. Muestra al usuario los nombres reales de los estados:
   ```
   Estados disponibles en el proyecto: [<estado1>, <estado2>, <estado3>, ...]
   ```
3. Pregunta tres veces (una por categoría del framework):
   - `¿Cuál corresponde a "pendiente" (Vision V2: pending)?` → propón el primero por defecto.
   - `¿Cuál corresponde a "en desarrollo" (Vision V2: in-progress)?`
   - `¿Cuál corresponde a "completada" (Vision V2: done)?` → propón el último por defecto.
4. Guarda los tres nombres exactos en `status_map`. Recuerda: se guardan como **nombres**, no como UUID — la skill `plane-sync` resuelve el UUID real en cada invocación (los estados de un proyecto pueden cambiar de id si se recrean).

#### Paso 4.5.d — Método de match feature ↔ work item

Pregunta:

> ¿Cómo asocias una feature de Vision V2 con su work item de Plane?
>
> a) Por nombre: el título del work item en Plane == el nombre de la feature en kebab-case (recomendado para empezar).
> b) Por propiedad personalizada: el proyecto tiene una propiedad (ej. "Vision Feature Name") cuyo valor es el nombre de la feature.

- Si elige `a` → `task_match.method = "by-name"`, `custom_field_name = null`.
- Si elige `b`:
  - Llama `workitem_property` con `action: "list"` y el `project_id`.
  - Muestra las propiedades disponibles numeradas.
  - Pregunta cuál es la del Vision feature name.
  - `task_match.method = "by-custom-field"`, `custom_field_name = <nombre de la propiedad>`.

#### Paso 4.5.e — Construir bloque YAML

Reemplaza el bloque `plane:` del constitution con:

```yaml
plane:
  enabled: true
  project_id: "<project_id>"
  status_map:
    pending: "<estado_real_pending>"
    in-progress: "<estado_real_in_progress>"
    done: "<estado_real_done>"
  task_match:
    method: "<by-name | by-custom-field>"
    custom_field_name: <null | "<nombre>">
```

### Paso 5 — Preview global y confirmación

Muestra al usuario los dos bloques finales (constitution + backlog) y pregunta:

> ¿Escribir estos archivos? (sí / cancelar)

Si cancela, termina con mensaje de cancelación, no escribas nada.

### Paso 6 — Escritura atómica

Si confirma:

1. Escribe `vision/constitution.md`.
2. Escribe `vision/backlog.md`.
3. Si cualquiera falla, restaura ambos desde los snapshots leídos en Prerequisitos y reporta el error.
4. Si ambas tienen éxito, muestra el mensaje final.

## Preguntas

Las 7 preguntas del Paso 3 son tu única interacción estructurada con el usuario. Aplican estas reglas:

- Haz una pregunta a la vez.
- Si tienes una propuesta confiable, formúlala como `Propuesta: <X>. ¿Lo confirmas? (sí / no / otro)`.
- Si el usuario responde `otro`, pide el valor concreto.
- No formules preguntas encadenadas en una sola respuesta (eso es de `/newspec`).
- Si el usuario en cualquier momento dice `cancelar`, `salir`, o interrumpe el flujo, aborta y no toques nada.

## Generación del Backlog

Estructura de cada sprint en `vision/backlog.md`:

```markdown
## Sprint N — <nombre descriptivo>

- [ ] **feature-name** — `vision/specs/<categoria>/feature-name/`
- [ ] **otra-feature** — `vision/specs/<categoria>/otra-feature/`
```

Reglas:

- `feature-name` en kebab-case: `[a-z0-9-]+`.
- Nombre del sprint descriptivo (ej: `"Frontend y Diseño Base"`, `"Autenticación y Sesión"`, `"Motor de Reportes"`). No uses solo `"Sprint 1"` como título.
- `<categoria>` sugerida según el tipo de feature: `commands/`, `skills/`, `core/`, `ui/`, `api/`, `data/`, `services/`. `/newspec` confirmará la categoría definitiva al crear cada spec.
- Si el proyecto tiene frontend: Sprint 1 = frontend/diseño, Sprint 2+ = backend.
- Si no tiene frontend: adapta el orden al tipo de proyecto.
  - CLI: Sprint 1 = comandos/UX, Sprint 2 = motor interno.
  - API pura: Sprint 1 = endpoints/contratos, Sprint 2 = lógica interna.
  - Librería: Sprint 1 = API pública, Sprint 2 = implementación.
  - Data pipeline: Sprint 1 = interfaces I/O, Sprint 2 = procesamiento.
- Cantidad de sprints y features por sprint: variable, según complejidad.

Tú **no** creas carpetas bajo `vision/specs/` ni archivos `0_contract.md`, `1_spec.md`, etc. Solo enumeras features en el backlog.

## Mensaje Final

Al terminar exitosamente (tras escritura atómica), muestra exactamente:

```
Constitution y backlog listos.

Próximo paso: corre /newspec para crear la spec detallada de cada feature del backlog.
Puedes pasarle a /newspec un archivo con respuestas prellenadas si ya tienes la idea clara.
```

## Casos Especiales

| Escenario | Acción |
|---|---|
| `vision/` no existe | Abortar; indicar `vision init` |
| `vision/constitution.md` ausente | Abortar; indicar `vision init` |
| `vision/backlog.md` ausente | Abortar; indicar `vision init` |
| Constitution con contenido real y usuario elige no rehacer | Terminar sin modificar nada |
| Usuario cancela | Descartar respuestas; no tocar archivos |
| Falla la escritura atómica | Rollback ambos archivos desde snapshots; reportar |

## Lo que NO haces (lo hace `/newspec`)

Para que no haya duda:

- No explores `src/`, `app/`, `lib/`, imágenes, ni documentos anidados.
- No hagas rondas formales por tema.
- No ofrezcas `a) b) c)` como 3 sugerencias excluyentes en cada pregunta.
- No muestres preview al final de cada ronda.
- No detectes estado por sección con regex de placeholders sofisticado.
- No crees directorios bajo `vision/specs/`.
- No generes archivos `0_contract.md`, `1_spec.md`, `2_acceptance-criteria.md`, `3_test-plan.md` de ninguna feature.
- No aceptes archivo con respuestas prellenadas como input (eso es `/newspec`).
- No propongas nombres para las features (eso es `/newspec` al crear cada spec).
- No leas work items de Plane ni los modifiques desde aquí. La integración con Plane solo se **configura** en este workflow (Paso 4.5); la lectura/sync vive en la skill `plane-sync` y la invocan los workflows `/newspec`, `/executespec` y `/onspecomplete`.
