---
name: clickup-sync
description: 'Sincroniza el ciclo de vida de las features de Vision V2 con tareas de ClickUp vía MCP. Tres operaciones: list-pending-tasks (lee tareas pendientes), mark-in-progress (mueve la tarea a "en desarrollo"), mark-done (cierra la tarea). Degrada silenciosamente si ClickUp no está configurado o el MCP no está disponible.'
---

# Clickup Sync

## Propósito

Mantener sincronizado el estado de las features del framework con las tareas correspondientes en ClickUp. Cuando un usuario crea una spec en `/newspec`, ejecuta una feature en `/executespec` o cierra el ciclo en `/onspecomplete`, esta skill propaga el cambio de estado a ClickUp.

Es una skill **invocada por workflows**, no por el usuario directamente. Los workflows `/setup`, `/newspec`, `/executespec` y `/onspecomplete` la invocan en momentos específicos.

## Entrada

Esta skill expone **tres operaciones**. La invocación lleva la operación como primer argumento:

| Operación | Argumentos adicionales | Output |
|---|---|---|
| `list-pending-tasks` | (ninguno) | Markdown con la lista de tareas en estado `pending` |
| `mark-in-progress` | `<feature-name>` (kebab-case) | Confirmación o aviso de no-op |
| `mark-done` | `<feature-name>` (kebab-case) | Confirmación o aviso de no-op |

Sintaxis de invocación según el IDE:

| IDE | Invocación |
|---|---|
| Claude Code | `/clickup-sync <operacion> [<feature-name>]` |
| Cursor | `@clickup-sync <operacion> [<feature-name>]` |
| Windsurf | `@clickup-sync <operacion> [<feature-name>]` |
| OpenCode | `/clickup-sync <operacion> [<feature-name>]` |
| Antigravity | invocación programática según convención |

Si el primer argumento no es una de las tres operaciones reconocidas, devuelve el output del Caso Especial 4.

## Algoritmo

Ejecuta los pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Verificar configuración de ClickUp en el constitution

1. Verifica que existe `vision/constitution.md`. Si no existe → devuelve el output del Caso Especial 1 y termina.
2. Lee el archivo y busca un bloque YAML (delimitado por triples backticks con la etiqueta `yaml`) que comience con la clave `clickup:` en el nivel raíz del bloque. La sección habitual donde vive es `## Integración ClickUp`.
3. Parsea el bloque YAML. Estructura esperada:
   ```yaml
   clickup:
     enabled: true
     workspace_id: "..."
     list_id: "..."
     status_map:
       pending: "to do"
       in-progress: "in progress"
       done: "complete"
     task_match:
       method: "by-name"           # o "by-custom-field"
       custom_field_name: null     # o el nombre del campo
   ```
4. Si el bloque no existe o `clickup.enabled` no es `true` → devuelve el output del Caso Especial 2 y termina (no-op silencioso).
5. Si faltan campos obligatorios (`list_id`, `status_map.pending`, `status_map.in-progress`, `status_map.done`) → devuelve el output del Caso Especial 3 y termina.

### Paso 2 — Verificar disponibilidad del MCP de ClickUp

1. Comprueba si las herramientas MCP con prefijo `clickup_` están disponibles en el contexto del agente.
2. Si **no** están disponibles → devuelve el output del Caso Especial 5 y termina (no-op silencioso). Este caso ocurre cuando el IDE no tiene el MCP de ClickUp conectado.

### Paso 3 — Despachar según operación

Lee el primer argumento (`operacion`) de la invocación. Salta a la subsección correspondiente:

- `list-pending-tasks` → Paso 4.
- `mark-in-progress` → Paso 5 con status target `status_map["in-progress"]`.
- `mark-done` → Paso 5 con status target `status_map["done"]`.

### Paso 4 — `list-pending-tasks`

1. Llama a la herramienta MCP `clickup_filter_tasks` con:
   - `list_id` = `clickup.list_id` del constitution.
   - `statuses` = `[clickup.status_map.pending]`.
   - `subtasks` = `false`.
   - `archived` = `false`.
2. Si la llamada falla → devuelve el output del Caso Especial 6 con el detalle del error.
3. Toma las primeras 20 tareas (más es ruido para el usuario).
4. Para cada tarea, extrae: `id`, `name`, `description` (truncado a 200 chars), `url`.
5. Devuelve el output del formato principal de `list-pending-tasks` (ver Sección "Formato de Salida").

### Paso 5 — `mark-in-progress` y `mark-done`

1. Verifica que `<feature-name>` cumple `^[a-z0-9-]+$`. Si no → devuelve el output del Caso Especial 7.
2. Resuelve el `task_id` correspondiente a la feature:
   - **Estrategia 1 (preferida)**: lee `vision/specs/**/0_contract.md` cuya carpeta padre coincida con `<feature-name>`. Si el frontmatter `## Metadata` contiene `clickup_task_id: "<id>"`, úsalo directo.
   - **Estrategia 2 (fallback por nombre)**: si `clickup.task_match.method == "by-name"`, llama `clickup_filter_tasks` con `list_id = clickup.list_id` y filtra los resultados quedándote con la tarea cuyo `name` (case-insensitive, normalizado: minúsculas + reemplazo de espacios por guiones) sea exactamente `<feature-name>`.
   - **Estrategia 3 (fallback por custom field)**: si `clickup.task_match.method == "by-custom-field"`, llama `clickup_get_custom_fields` para `clickup.list_id`, localiza el campo cuyo `name` coincida con `clickup.task_match.custom_field_name`, llama `clickup_filter_tasks` con un filtro por ese custom field == `<feature-name>`.
3. Si después de todas las estrategias no se resuelve un único `task_id` → devuelve el output del Caso Especial 8 (no-op).
4. Llama `clickup_get_task` con el `task_id` para leer el status actual.
5. Compara el status actual con el target:
   - Si `task.status.status` (case-insensitive) == status target → devuelve el output del formato `already-in-target-status` (idempotencia).
   - Si no → continúa.
6. Llama `clickup_update_task` con:
   - `task_id` = el resuelto.
   - `status` = el nombre del status target (string exactamente como aparece en el constitution).
7. Si la llamada falla → devuelve el output del Caso Especial 6.
8. Devuelve el output del formato `transition-success`.

## Formato de Salida

### `list-pending-tasks` — formato principal

```markdown
## Tareas pendientes en ClickUp

Lista: `<list_id>` · Status pendiente mapeado: `<status_map.pending>`

| # | ID | Nombre | Descripción (extracto) |
|---|---|---|---|
| 1 | <task.id> | <task.name> | <task.description truncada> |
| 2 | ... | ... | ... |

Total: <N> tareas pendientes.
```

Si la lista está vacía:

```markdown
## Tareas pendientes en ClickUp

No hay tareas en estado `<status_map.pending>` en la lista `<list_id>`.
```

### `mark-in-progress` / `mark-done` — `transition-success`

```markdown
## ClickUp sincronizado

Tarea `<task.name>` (id: `<task.id>`) movida de `<status_anterior>` a `<status_target>`.
URL: <task.url>
```

### `mark-in-progress` / `mark-done` — `already-in-target-status`

```markdown
## ClickUp ya sincronizado

Tarea `<task.name>` (id: `<task.id>`) ya está en `<status_target>`. No se requiere update.
```

## Casos Especiales

### Caso Especial 1 — Sin constitution

```markdown
## clickup-sync omitido

No encuentro `vision/constitution.md`. Corre `vision init` y `/setup` para configurar el proyecto.
```

### Caso Especial 2 — ClickUp no configurado o deshabilitado

```markdown
## clickup-sync omitido

ClickUp no está configurado en `vision/constitution.md` (o `clickup.enabled` es `false`). El workflow continúa normalmente.

Para habilitar la integración con ClickUp, corre `/setup` y elige "sí" cuando pregunte por la integración.
```

### Caso Especial 3 — Configuración incompleta

```markdown
## clickup-sync omitido (configuración incompleta)

El bloque `clickup:` en el constitution está incompleto. Faltan campos obligatorios: <lista de campos>.

Edita `vision/constitution.md` o vuelve a correr `/setup`.
```

### Caso Especial 4 — Operación desconocida

```markdown
## clickup-sync error

Operación desconocida: `<operacion>`. Operaciones válidas:
- `list-pending-tasks`
- `mark-in-progress <feature-name>`
- `mark-done <feature-name>`
```

### Caso Especial 5 — MCP no disponible

```markdown
## clickup-sync omitido (MCP no disponible)

Las herramientas MCP de ClickUp no están conectadas en este IDE. El workflow continúa normalmente.

Configura el MCP de ClickUp si quieres que el ciclo de vida de las features se sincronice con tu workspace.
```

### Caso Especial 6 — Error en la llamada al MCP

```markdown
## clickup-sync error

La llamada a ClickUp falló: <detalle del error>.

El workflow continúa, pero el estado en ClickUp **no** quedó sincronizado. Sincroniza manualmente o reintenta la operación.
```

### Caso Especial 7 — `feature-name` inválido

```markdown
## clickup-sync error

`<feature-name>` no es un identificador kebab-case válido. Usa solo `[a-z0-9-]+`.
```

### Caso Especial 8 — Tarea no encontrada

```markdown
## clickup-sync omitido (tarea no encontrada)

No encuentro una tarea de ClickUp asociada a la feature `<feature-name>`.

Métodos intentados: <lista de estrategias>.

Crea la tarea en ClickUp con el mismo nombre, o agrega `clickup_task_id` al frontmatter de `vision/specs/.../<feature-name>/0_contract.md`.
```

## Reglas Clave

1. **Degradación silenciosa**: la skill nunca debe romper el workflow que la invoca. Si algo falla, devuelve un mensaje informativo y termina con éxito (el output es texto, no excepción).
2. **Idempotencia**: nunca hace un update redundante. Lee el status actual antes de transicionar.
3. **No mutas archivos del framework**: no escribes a `vision-status.json`, ni a `0_contract.md`, ni a ningún otro archivo. Esos los actualizan los workflows que te invocan.
4. **Confianza en el constitution**: el mapeo de status, el list_id y el método de match son responsabilidad del usuario (vía `/setup`). Tú no validas que el mapeo tenga sentido, solo lo aplicas.
5. **No haces preguntas al usuario**. Eres una skill de ejecución directa.
