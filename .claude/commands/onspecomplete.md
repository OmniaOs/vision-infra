---
name: onspecomplete
description: 'Cierra el ciclo de una feature in-progress: agrega entry a Módulos Implementados en el constitution, marca checkbox en backlog con fecha, y actualiza vision-status.json a done. No hace preguntas; ejecuta directamente.'
---

# /onspecomplete — Cerrar Feature

Eres un agente ejecutando `/onspecomplete` de Vision V2. Tu tarea es cerrar formalmente el ciclo de una feature cuya implementación ya está validada por el usuario.

**No hagas preguntas al usuario.** Solo ejecuta los pasos en orden. Instrucciones imperativas, lineales.

Toda tu interacción y los textos que insertes en los archivos están en español.

## Argumentos

`/onspecomplete <feature-name>` — obligatorio, kebab-case.

Si el usuario invoca `/onspecomplete` sin argumento, aborta con el mensaje exacto:

```
Uso: /onspecomplete <feature-name>
```

## Prerequisitos

1. Busca recursivamente bajo `vision/specs/` una carpeta llamada exactamente `<feature-name>`. Si no la encuentras, aborta:
   ```
   No encuentro vision/specs/.../<feature-name>/. Verifica el nombre o corre /newspec para crearla.
   ```

2. Verifica que dentro de esa carpeta existen los 4 archivos:
   - `0_contract.md`
   - `1_spec.md`
   - `2_acceptance-criteria.md`
   - `3_test-plan.md`

   Si falta alguno, aborta:
   ```
   Falta <archivo> en la spec de <feature-name>. Corre /newspec <feature-name> primero.
   ```

3. Verifica que existen los archivos de estado del framework:
   - `vision/constitution.md`
   - `vision/backlog.md`
   - `vision/vision-status.json`

   Si falta alguno, aborta:
   ```
   Falta <archivo>. Corre `vision init` primero.
   ```

## Pasos

Ejecuta los pasos en orden. No omitas ninguno.

### Paso 1 — Validar status actual

Lee `vision/vision-status.json`. Busca el entry con `name == <feature-name>`:

- Si **no existe** el entry:
  ```
  La feature <feature-name> no está registrada en vision-status.json.
  ```
  Aborta.

- Si `status == "pending"`:
  ```
  La feature <feature-name> está en `pending`. Corre /executespec <feature-name> primero para implementarla.
  ```
  Aborta.

- Si `status == "done"`:
  ```
  La feature <feature-name> ya está marcada como `done` (completada <completedAt>).
  ```
  Aborta.

- Si `status == "in-progress"`: continúa.

### Paso 2 — Leer los archivos relevantes

Lee en memoria:

- Los 4 archivos de la feature (`0_contract.md`, `1_spec.md`, `2_acceptance-criteria.md`, `3_test-plan.md`).
- `vision/constitution.md`.
- `vision/backlog.md`.
- `vision/vision-status.json`.

**Guarda snapshots** de los 4 archivos que vas a modificar (constitution, backlog, vision-status y el `0_contract.md` de la feature) para rollback.

Extrae del `## Propósito` del contrato la **primera oración** (hasta el primer `.`, `!` o `?`), truncada a 120 caracteres si excede (añadiendo `…` sin cortar palabras a mitad). Esta es la **descripción corta** que irá en el constitution.

### Paso 3 — Determinar la fecha

Fecha del día de ejecución:
- Formato corto `YYYY-MM-DD` — para `completedAt` y las fechas visibles en los archivos markdown.
- Formato ISO completo `YYYY-MM-DDTHH:MM:SSZ` — **solo** para `lastUpdated` en `vision-status.json`.

Usa la misma fecha corta en los 4 archivos.

### Paso 4 — Preparar constitution actualizado

Localiza la sección `## Módulos Implementados` en `vision/constitution.md`:

- Si existe, ve al final de la sección.
- Si no existe, agrégala al final del archivo (antes del último separador `---` o al final si no hay).

Si la sección contiene el placeholder `_Ningún módulo implementado aún._` (o cadena idéntica al placeholder del template), elimínalo antes de insertar.

Inserta al final de la sección:

```
- **<feature-name>** (`vision/specs/<categoria>/<feature-name>/`) — <descripción corta>. Completado: `YYYY-MM-DD`.
```

Donde `<categoria>` es la carpeta real donde está la feature.

### Paso 5 — Preparar backlog actualizado

Busca el item `- [ ] **<feature-name>** — ` en cualquier sprint del backlog.

Cámbialo a:

```
- [x] **<feature-name>** — `vision/specs/<categoria>/<feature-name>/` — _YYYY-MM-DD_
```

**Importante**: el item permanece en su sprint original. No lo muevas.

### Paso 6 — Preparar `vision-status.json` actualizado

En el entry de la feature:
- `status`: `"done"`
- `completedAt`: `"YYYY-MM-DD"`

A nivel raíz del JSON:
- `lastUpdated`: `"YYYY-MM-DDTHH:MM:SSZ"` (ISO completo).

### Paso 7 — Preparar `0_contract.md` de la feature actualizado

En el bloque YAML de `## Metadata`:
- `status: done` (reemplaza `pending` o `in-progress` si aparecen).
- `updated: YYYY-MM-DD`.

No toques el resto del archivo.

### Paso 8 — Escribir los 4 archivos

Escribe en este orden:

1. `vision/constitution.md`
2. `vision/backlog.md`
3. `vision/vision-status.json`
4. `vision/specs/<categoria>/<feature-name>/0_contract.md`

Si **cualquiera** falla a mitad:

- Restaura los archivos ya escritos desde los snapshots del Paso 2.
- Reporta el error:
  ```
  Error al escribir <archivo>: <detalle>. Rollback aplicado — todo quedó como antes.
  ```
- Termina.

### Paso 8.5 — Sincronizar work item de Plane como "completado"

Tras la escritura exitosa de los 4 archivos (Paso 8), invoca la skill `plane-sync` para cerrar el work item correspondiente:

| IDE | Invocación |
|-----|------------|
| Claude Code | `/plane-sync mark-done <feature-name>` |
| Cursor | `@plane-sync mark-done <feature-name>` |
| Windsurf | `@plane-sync mark-done <feature-name>` |
| OpenCode | `/plane-sync mark-done <feature-name>` |
| Antigravity | invocación programática según convención |

La skill degrada silenciosamente si:

- Plane no está configurado en el constitution.
- El MCP de Plane no está disponible.
- No encuentra un work item asociado a la feature.

**No hagas rollback** si la skill devuelve un caso especial. La fuente de verdad del framework son los 4 archivos markdown + `vision-status.json`, y esos ya quedaron escritos. Anota el output para el mensaje final.

### Paso 9 — Mensaje final

Muestra al usuario:

```
/onspecomplete completado para <feature-name>.

Actualizaciones aplicadas:
- Constitution: nuevo entry en ## Módulos Implementados.
- Backlog: item marcado [x] con fecha YYYY-MM-DD.
- vision-status.json: status → done, completedAt → YYYY-MM-DD.
- 0_contract.md de la feature: status → done.

Plane: <output del Paso 8.5 — confirmación, "ya sincronizado", o aviso de no-op>

Ciclo de la feature cerrado.
```

Si el output de la skill `plane-sync` en el Paso 8.5 fue un caso especial de no-op, incluye la línea tal cual la devolvió la skill.

## Formato del Entry en Constitution

```
- **<feature-name>** (`vision/specs/<categoria>/<feature-name>/`) — <descripción corta (primera oración del propósito, máx 120 caracteres)>. Completado: `YYYY-MM-DD`.
```

## Manejo de Errores

| Escenario | Acción |
|---|---|
| Argumento faltante | Aborta con mensaje de uso |
| Feature no existe | Aborta, sugiere verificar nombre |
| Faltan archivos de spec | Aborta, sugiere `/newspec` |
| Faltan archivos de estado del framework | Aborta, sugiere `vision init` |
| Feature no registrada en vision-status | Aborta con mensaje dirigido |
| Status `pending` | Aborta, sugiere `/executespec` |
| Status `done` | Aborta, informa `completedAt` |
| Falla escritura de cualquiera de los 4 archivos | Rollback desde snapshots, reporta |

## Mensaje Final

Ver Paso 9.

## Reglas Clave

Para ti, agente:

1. **No preguntes al usuario nada.** Ejecutas directo.
2. **Solo procedes si status es `in-progress`.** Si no, aborta con el mensaje correspondiente.
3. **Transaccionalidad**: los 4 archivos se escriben; si uno falla, se revierten todos.
4. **Preservas el sprint original** del backlog al marcar el item como completado.
5. **No tocas otras secciones** del constitution; solo añades al final de `## Módulos Implementados`.
6. **Fecha uniforme** en los 4 archivos (la del día de ejecución).
