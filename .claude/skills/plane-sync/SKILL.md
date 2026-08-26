---
name: plane-sync
description: 'Sincroniza el ciclo de vida de las features de Vision V2 con work items de Plane vía MCP. Tres operaciones: list-pending-tasks (lee work items pendientes), mark-in-progress (mueve el work item a "en desarrollo"), mark-done (cierra el work item). Degrada silenciosamente si Plane no está configurado o el MCP no está disponible.'
---

# Plane Sync

## Propósito

Mantener sincronizado el estado de las features del framework con los work items correspondientes en Plane. Cuando un usuario crea una spec en `/newspec`, ejecuta una feature en `/executespec` o cierra el ciclo en `/onspecomplete`, esta skill propaga el cambio de estado a Plane.

Es una skill **invocada por workflows**, no por el usuario directamente. Los workflows `/setup`, `/newspec`, `/executespec` y `/onspecomplete` la invocan en momentos específicos.

## Entrada

Esta skill expone **tres operaciones**. La invocación lleva la operación como primer argumento:

| Operación | Argumentos adicionales | Output |
|---|---|---|
| `list-pending-tasks` | (ninguno) | Markdown con la lista de work items en estado `pending` |
| `mark-in-progress` | `<feature-name>` (kebab-case) | Confirmación o aviso de no-op |
| `mark-done` | `<feature-name>` (kebab-case) | Confirmación o aviso de no-op |

Sintaxis de invocación según el IDE:

| IDE | Invocación |
|---|---|
| Claude Code | `/plane-sync <operacion> [<feature-name>]` |
| Cursor | `@plane-sync <operacion> [<feature-name>]` |
| Windsurf | `@plane-sync <operacion> [<feature-name>]` |
| OpenCode | `/plane-sync <operacion> [<feature-name>]` |
| Antigravity | invocación programática según convención |

Si el primer argumento no es una de las tres operaciones reconocidas, devuelve el output del Caso Especial 4.

## Algoritmo

Ejecuta los pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Verificar configuración de Plane en el constitution

1. Verifica que existe `vision/constitution.md`. Si no existe → devuelve el output del Caso Especial 1 y termina.
2. Lee el archivo y busca un bloque YAML (delimitado por triples backticks con la etiqueta `yaml`) que comience con la clave `plane:` en el nivel raíz del bloque. La sección habitual donde vive es `## Integración Plane`.
3. Parsea el bloque YAML. Estructura esperada:
   ```yaml
   plane:
     enabled: true
     project_id: "..."
     status_map:
       pending: "to do"
       in-progress: "in progress"
       done: "done"
     task_match:
       method: "by-name"           # o "by-custom-field"
       custom_field_name: null     # o el nombre de la propiedad
   ```
4. Si el bloque no existe o `plane.enabled` no es `true` → devuelve el output del Caso Especial 2 y termina (no-op silencioso).
5. Si faltan campos obligatorios (`project_id`, `status_map.pending`, `status_map.in-progress`, `status_map.done`) → devuelve el output del Caso Especial 3 y termina.

### Paso 2 — Verificar disponibilidad del MCP de Plane

1. Comprueba si las herramientas MCP `workitem` y `state` (del servidor `plane`) están disponibles en el contexto del agente. A diferencia de ClickUp, el MCP de Plane no prefija sus herramientas por integración (son `workitem`, `state`, `workitem_property`, etc., despachadas internamente vía un parámetro `action`) — así que la comprobación es "¿existen las herramientas `workitem` y `state`?", no un prefijo de nombre.
2. Si **no** están disponibles → devuelve el output del Caso Especial 5 y termina (no-op silencioso). Este caso ocurre cuando el IDE no tiene el MCP de Plane conectado.

### Paso 3 — Despachar según operación

Lee el primer argumento (`operacion`) de la invocación. Salta a la subsección correspondiente:

- `list-pending-tasks` → Paso 5.
- `mark-in-progress` → Paso 6 con status target `status_map["in-progress"]`.
- `mark-done` → Paso 6 con status target `status_map["done"]`.

### Paso 4 — `resolveStateId(statusName, project_id)` (helper reutilizable)

Plane, a diferencia de ClickUp, no acepta el nombre del status como string en un update: el campo `state` es una relación que exige **UUID**. Este paso resuelve un nombre de status del `status_map` a su UUID real dentro del proyecto, y lo usan tanto el Paso 5 como el Paso 6.

1. Llama a la herramienta MCP `state` con `action: "list"` y `project_id`.
2. Busca en el resultado el estado cuyo `name` (case-insensitive, trim) coincida exactamente con `statusName`.
3. Si hay match → devuelve su `id` (UUID).
4. Si **no** hay match → devuelve `null`. Quien invoca este helper trata `null` como el Caso Especial 9.

```pseudocode
function resolveStateId(statusName, project_id):
    states = state({ action: "list", project_id })
    match = states.find(s => normalize(s.name) == normalize(statusName))
    return match ? match.id : null
```

### Paso 5 — `list-pending-tasks`

1. Resuelve `pending_state_id = resolveStateId(plane.status_map.pending, plane.project_id)` (Paso 4).
2. Si `pending_state_id == null` → devuelve el output del Caso Especial 9.
3. Llama a la herramienta MCP `workitem` con `action: "list"`, `project_id = plane.project_id`, y un filtro `pql` que restrinja por el estado resuelto.
   > Nota: la sintaxis exacta de un filtro `pql` por estado (algo equivalente a `state = "<pending_state_id>"`) no se ha podido confirmar contra una conexión MCP de Plane real al escribir esta skill. Usa la referencia PQL que exponga el servidor (herramienta `get_pql_reference` si está disponible) y ajusta esta llamada si la primera ejecución en producción falla. El resto del algoritmo no depende de este detalle.
4. Si la llamada falla → devuelve el output del Caso Especial 6 con el detalle del error.
5. Toma los primeros 20 work items (más es ruido para el usuario).
6. Para cada work item, extrae: `identifier` (ej. `ENG-42`), `name`, `description` (truncada a 200 chars).
7. Devuelve el output del formato principal de `list-pending-tasks` (ver Sección "Formato de Salida").

### Paso 6 — `mark-in-progress` y `mark-done`

1. Verifica que `<feature-name>` cumple `^[a-z0-9-]+$`. Si no → devuelve el output del Caso Especial 7.
2. Resuelve `target_state_id = resolveStateId(target, plane.project_id)` (Paso 4), donde `target` es el status_map recibido del Paso 3.
3. Si `target_state_id == null` → devuelve el output del Caso Especial 9.
4. Resuelve el work item correspondiente a la feature con `resolveWorkitem(featureName, config)` (Paso 7).
5. Si no se resuelve un único work item → devuelve el output del Caso Especial 8 (no-op).
6. Compara el estado actual del work item resuelto con el target:
   - Si `workitem.state` (UUID) == `target_state_id` → devuelve el output del formato `already-in-target-status` (idempotencia).
   - Si no → continúa.
7. Llama `workitem` con `action: "update"`, `project_id = plane.project_id`, `workitem_id = <UUID del work item>`, `state = target_state_id`.
8. Si la llamada falla → devuelve el output del Caso Especial 6.
9. Devuelve el output del formato `transition-success`.

### Paso 7 — `resolveWorkitem(featureName, config)`

Estrategia 1 (preferida): leer `plane_workitem_id` del frontmatter del `0_contract.md` de la feature. Este campo guarda el **identificador humano** de Plane (formato `PROJECT-N`, ej. `ENG-42`), no el UUID interno.

```pseudocode
contract = findFile(`vision/specs/**/{featureName}/0_contract.md`)
if contract:
    metadata = parseFrontmatter(contract)
    if metadata.plane_workitem_id and metadata.plane_workitem_id != null:
        item = workitem({ action: "retrieve_by_identifier", workitem_identifier: metadata.plane_workitem_id })
        if item and !item.error:
            return item   // incluye id (UUID), project_id, state, name, identifier
```

Estrategia 2 (fallback por nombre):

```pseudocode
if config.task_match.method == "by-name":
    candidates = workitem({ action: "list", project_id: config.project_id })
    matches = candidates.items.filter(i =>
        normalizeName(i.name) == featureName
    )
    if matches.length == 1: return matches[0]
    if matches.length == 0: continue
    if matches.length > 1: return null   # ambigüedad
```

Estrategia 3 (fallback por propiedad personalizada):

```pseudocode
if config.task_match.method == "by-custom-field":
    properties = workitem_property({ action: "list", project_id: config.project_id })
    property = properties.find(p => p.name == config.task_match.custom_field_name)
    if !property: return null
    candidates = workitem({ action: "list", project_id: config.project_id, expand: ["properties"] })
    matches = candidates.items.filter(i =>
        getPropertyValue(i, property.id) == featureName
    )
    if matches.length == 1: return matches[0]

return null
```

> Nota: al igual que el filtro `pql` del Paso 5, la forma exacta de leer el valor de una propiedad personalizada sobre un work item devuelto por `workitem action=list` (vía `expand` o `fields`) no se ha podido confirmar contra una conexión MCP de Plane real. Si la primera ejecución en producción de la Estrategia 3 falla, ajusta la llamada según lo que el servidor MCP realmente devuelva.

`normalizeName` aplica: lowercase, trim, reemplazar espacios y guiones bajos por guiones simples, colapsar guiones consecutivos.

Si después de todas las estrategias no se resuelve un único work item → `null` (tratado como Caso Especial 8 por quien invoca este helper).

## Formato de Salida

### `list-pending-tasks` — formato principal

```markdown
## Work items pendientes en Plane

Proyecto: `<project_id>` · Estado pendiente mapeado: `<status_map.pending>`

| # | Identificador | Nombre | Descripción (extracto) |
|---|---|---|---|
| 1 | <item.identifier> | <item.name> | <item.description truncada> |
| 2 | ... | ... | ... |

Total: <N> work items pendientes.
```

Si la lista está vacía:

```markdown
## Work items pendientes en Plane

No hay work items en estado `<status_map.pending>` en el proyecto `<project_id>`.
```

### `mark-in-progress` / `mark-done` — `transition-success`

```markdown
## Plane sincronizado

Work item `<workitem.name>` (`<workitem.identifier>`) movido de `<status_anterior>` a `<status_target>`.
Ábrelo en Plane buscando `<workitem.identifier>` dentro del proyecto.
```

### `mark-in-progress` / `mark-done` — `already-in-target-status`

```markdown
## Plane ya sincronizado

Work item `<workitem.name>` (`<workitem.identifier>`) ya está en `<status_target>`. No se requiere update.
```

## Casos Especiales

### Caso Especial 1 — Sin constitution

```markdown
## plane-sync omitido

No encuentro `vision/constitution.md`. Corre `vision init` y `/setup` para configurar el proyecto.
```

### Caso Especial 2 — Plane no configurado o deshabilitado

```markdown
## plane-sync omitido

Plane no está configurado en `vision/constitution.md` (o `plane.enabled` es `false`). El workflow continúa normalmente.

Para habilitar la integración con Plane, corre `/setup` y elige "sí" cuando pregunte por la integración.
```

### Caso Especial 3 — Configuración incompleta

```markdown
## plane-sync omitido (configuración incompleta)

El bloque `plane:` en el constitution está incompleto. Faltan campos obligatorios: <lista de campos>.

Edita `vision/constitution.md` o vuelve a correr `/setup`.
```

### Caso Especial 4 — Operación desconocida

```markdown
## plane-sync error

Operación desconocida: `<operacion>`. Operaciones válidas:
- `list-pending-tasks`
- `mark-in-progress <feature-name>`
- `mark-done <feature-name>`
```

### Caso Especial 5 — MCP no disponible

```markdown
## plane-sync omitido (MCP no disponible)

Las herramientas MCP de Plane (`workitem`, `state`) no están conectadas en este IDE. El workflow continúa normalmente.

Configura el MCP de Plane si quieres que el ciclo de vida de las features se sincronice con tu workspace.
```

### Caso Especial 6 — Error en la llamada al MCP

```markdown
## plane-sync error

La llamada a Plane falló: <detalle del error>.

El workflow continúa, pero el estado en Plane **no** quedó sincronizado. Sincroniza manualmente o reintenta la operación.
```

### Caso Especial 7 — `feature-name` inválido

```markdown
## plane-sync error

`<feature-name>` no es un identificador kebab-case válido. Usa solo `[a-z0-9-]+`.
```

### Caso Especial 8 — Work item no encontrado

```markdown
## plane-sync omitido (work item no encontrado)

No encuentro un work item de Plane asociado a la feature `<feature-name>`.

Métodos intentados: <lista de estrategias>.

Crea el work item en Plane con el mismo nombre, o agrega `plane_workitem_id` (identificador tipo `PROJECT-N`) al frontmatter de `vision/specs/.../<feature-name>/0_contract.md`.
```

### Caso Especial 9 — Estado configurado no existe en Plane

```markdown
## plane-sync omitido (estado no encontrado)

El `status_map` del constitution apunta al nombre de estado `<statusName>`, pero el proyecto `<project_id>` en Plane no tiene ningún estado con ese nombre.

Es posible que el workflow de estados del proyecto haya cambiado desde que corriste `/setup`. Vuelve a correr `/setup` para remapear los estados, o edita `status_map` directamente en `vision/constitution.md` con un nombre de estado real (corre `state action=list` para verlos).
```

## Reglas Clave

1. **Degradación silenciosa**: la skill nunca debe romper el workflow que la invoca. Si algo falla, devuelve un mensaje informativo y termina con éxito (el output es texto, no excepción).
2. **Idempotencia**: nunca hace un update redundante. Lee el estado actual antes de transicionar.
3. **No mutas archivos del framework**: no escribes a `vision-status.json`, ni a `0_contract.md`, ni a ningún otro archivo. Esos los actualizan los workflows que te invocan.
4. **Confianza en el constitution**: el mapeo de status, el `project_id` y el método de match son responsabilidad del usuario (vía `/setup`). Tú no validas que el mapeo tenga sentido, solo lo aplicas (salvo la resolución de UUID del Paso 4, que es mecánica, no de negocio).
5. **No haces preguntas al usuario**. Eres una skill de ejecución directa.
