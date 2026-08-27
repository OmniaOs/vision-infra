# Plan de Testing: Verificar plane-sync end-to-end

## Metadata

```yaml
test_framework: ninguno (validación manual vía llamadas MCP reales)
version: 1
last_updated: 2026-08-27
```

## Estrategia de Testing

Esta feature verifica una integración entre Claude Code y un servidor MCP externo (`plane`), no código de aplicación de este repo. El constitution declara `Testing: ninguno configurado todavía` y no existe ningún framework de test (unit/integration) para esto en `vision-infra` — sería una ficción escribir aquí una suite `vitest`/`jest` que no correría contra nada real.

Por eso este plan es **enteramente manual**, y con una particularidad importante: **no usa `curl` ni ningún cliente HTTP**. El objeto bajo prueba (`plane-sync`) no es un endpoint expuesto por red — es una skill de Claude Code que despacha llamadas a herramientas MCP (`mcp__plane__workitem`, `mcp__plane__state`, etc.). Verificarla correctamente significa invocar esas mismas herramientas MCP directamente, en paralelo a invocar la skill, y comparar resultados — exactamente el patrón que ya usa `2_acceptance-criteria.md` (verificación "independiente" vía `retrieve`).

La ejecución la hace la misma persona que corre `/executespec verify-plane-sync-end-to-end` (Daniel, u otro miembro del equipo con el MCP de Plane conectado), siguiendo el Algoritmo de `1_spec.md` paso a paso.

### Qué no se testa

- El servidor MCP de Plane en sí (`plane`, vía `uvx`) — se asume correcto; esta verificación prueba la integración de la skill `plane-sync` con ese servidor, no el servidor mismo.
- La UI web de Plane — fuera del alcance; toda verificación pasa por llamadas MCP, no por captura de pantalla de la consola web (salvo para confirmar visualmente el cleanup final, opcional).
- Concurrencia — si dos ejecuciones de esta verificación corrieran en paralelo sobre el mismo proyecto, Plane resuelve el conflicto; no es un escenario que esta spec necesite cubrir (una sola persona ejecuta esto a la vez).
- La matriz completa de fixtures (`fixture-no-plane`, `fixture-disabled`, etc.) de `VisionFramework/vision/specs/skills/skill-plane-sync/3_test-plan.md` — esa suite ya cubre la skill en abstracto; esta es una verificación dirigida contra el uso real de `vision-infra`.

---

## Validación Manual

Ejecutar en orden, con el MCP de Plane conectado. Sustituir `<uuid>` por el `id` devuelto en el Paso 1 y `<identifier>` por el `identifier` humano (ej. `VINF-N`) devuelto en la misma respuesta.

### Paso 0 — Precondiciones (no cubre ningún AC directamente, pero bloquea todo lo demás)

```
mcp__plane__project({ action: "list" })
```

**Esperado:** el proyecto `Vision Infra` (`VINF`, `project_id: "ca75c562-081c-4236-904d-b403484dcf7d"`) aparece en la respuesta. Si esta llamada falla, detener aquí — reportar bloqueado (Escenario F de `0_contract.md`), no continuar.

Adicionalmente, revisar si ya existe un work item `zz-test-*` de una corrida anterior sin cleanup:

```
mcp__plane__workitem({ action: "list", project_id: "ca75c562-081c-4236-904d-b403484dcf7d" })
```

Si aparece alguno con nombre normalizado `zz-test-verify-plane-sync`, borrarlo (`action: "delete"`) antes de continuar.

### Paso 1 — Crear el work item de prueba (cubre AC-001)

```
mcp__plane__workitem({
  action: "create",
  project_id: "ca75c562-081c-4236-904d-b403484dcf7d",
  name: "zz-test-verify-plane-sync",
  description: "Work item de prueba temporal para verify-plane-sync-end-to-end (vision-infra). Seguro borrar/ignorar."
})
```

**Esperado:** respuesta sin error, con `id` (UUID) e `identifier` (ej. `VINF-N`) presentes. El campo `state` corresponde al estado por defecto del proyecto, que debe ser el mapeado como `pending` ("Todo").

Guardar `id` e `identifier` — se reutilizan en todos los pasos siguientes.

### Paso 2 — `list-pending-tasks` y diagnóstico de PQL si hace falta (cubre AC-002, AC-003, AC-012, AC-013)

```
/plane-sync list-pending-tasks
```

**Esperado (caso feliz):** la tabla de salida incluye una fila con `<identifier>` / `zz-test-verify-plane-sync`, y el encabezado indica `Proyecto: ca75c562-081c-4236-904d-b403484dcf7d · Estado pendiente mapeado: Todo`.

**Si el item NO aparece:**

1. ```
   mcp__plane__get_pql_reference({})
   ```
   Revisar la sintaxis real documentada.

2. Reintentar manualmente con el filtro corregido:
   ```
   mcp__plane__workitem({
     action: "list",
     project_id: "ca75c562-081c-4236-904d-b403484dcf7d",
     pql: "<filtro corregido según get_pql_reference>"
   })
   ```
   **Esperado:** ahora sí incluye el item de prueba.

3. Editar `C:\Users\carri\OneDrive\Escritorio\Omnia\VisionFramework\skills\plane-sync.md` (Paso 5, punto 3) con la sintaxis confirmada; quitar la nota "no se ha podido confirmar" de ese punto.

4. Commitear **en el repo `VisionFramework`** (no en `vision-infra`):
   ```
   git -C "C:\Users\carri\OneDrive\Escritorio\Omnia\VisionFramework" add skills/plane-sync.md
   git -C "C:\Users\carri\OneDrive\Escritorio\Omnia\VisionFramework" commit -m "fix(plane-sync): corrige sintaxis PQL del filtro por estado, verificado en vision-infra/verify-plane-sync-end-to-end"
   ```

5. Reinvocar `/plane-sync list-pending-tasks` y confirmar que ahora el item aparece.

### Paso 3 — `mark-in-progress` + verificación independiente (cubre AC-004, AC-005)

```
/plane-sync mark-in-progress zz-test-verify-plane-sync
```

**Esperado:** mensaje `## Plane sincronizado` (formato `transition-success`), mencionando `<identifier>`, estado anterior "Todo" y estado destino "In Progress".

Verificación independiente (obligatoria, no opcional):

```
mcp__plane__workitem({ action: "retrieve", workitem_id: "<uuid>" })
```

**Esperado:** el campo `state` (UUID) coincide con el UUID del estado `"In Progress"` de `VINF` — obtenible con:

```
mcp__plane__state({ action: "list", project_id: "ca75c562-081c-4236-904d-b403484dcf7d" })
```

y comparando por `name` (case-insensitive). Guardar el `updated_at` de la respuesta de `retrieve` — se usa en el Paso 4.

### Paso 4 — Reinvocar `mark-in-progress`: idempotencia real (cubre AC-006, AC-007)

```
/plane-sync mark-in-progress zz-test-verify-plane-sync
```

**Esperado:** mensaje `## Plane ya sincronizado` (formato `already-in-target-status`).

Verificación independiente:

```
mcp__plane__workitem({ action: "retrieve", workitem_id: "<uuid>" })
```

**Esperado:** `updated_at` es **idéntico** al valor guardado en el Paso 3 — si cambió, la skill ejecutó un `update` redundante pese a reportar idempotencia (fallo, ver Manejo de Errores de `1_spec.md`).

### Paso 5 — `mark-done` + verificación final (cubre AC-008)

```
/plane-sync mark-done zz-test-verify-plane-sync
```

**Esperado:** mensaje `transition-success` de "In Progress" a "Done".

```
mcp__plane__workitem({ action: "retrieve", workitem_id: "<uuid>" })
```

**Esperado:** `state` (UUID) coincide con el UUID del estado `"Done"`.

### Paso 6 — Reinvocar `mark-done`: idempotencia en el estado final (cubre AC-009)

```
/plane-sync mark-done zz-test-verify-plane-sync
```

**Esperado:** `already-in-target-status`; verificar con `retrieve` que `updated_at` no cambió respecto al Paso 5, igual que en el Paso 4.

### Paso 7 — Cleanup (cubre AC-010, AC-011)

```
mcp__plane__workitem({ action: "delete", workitem_id: "<uuid>" })
```

**Esperado:** confirmación de borrado sin error.

Verificar:

```
mcp__plane__workitem({ action: "list", project_id: "ca75c562-081c-4236-904d-b403484dcf7d" })
```

**Esperado:** el listado ya no incluye ningún work item `zz-test-verify-plane-sync` — el proyecto `VINF` queda sin residuo de esta verificación.

### Paso 8 — Registro del gap de Estrategia 3 (cubre AC-014)

Inspección manual, no comando: confirmar que `1_spec.md` (Historial de Cambios) o `0_contract.md` (Notas de Implementación) de esta misma spec incluye una línea explícita dejando constancia de que el gap de la Estrategia 3 de `resolveWorkitem` (lectura de propiedad personalizada vía `expand`/`fields`) sigue sin confirmar — no se resolvió como parte de esta verificación (INV-5 de `1_spec.md`).

### Paso 9 — Revisión de evidencia (cubre AC-015)

Inspección manual: revisar que cada uno de los Pasos 1 a 7 tiene asociado el output crudo real de la llamada MCP correspondiente (copiado o resumido con fidelidad, no reconstruido de memoria) antes de dar por completa la feature.

---

## Helpers y Fixtures

No aplica un harness de fixtures automatizado. Los únicos insumos son:

- El proyecto `VINF` ya existente en Plane (`project_id: ca75c562-081c-4236-904d-b403484dcf7d`), con sus tres estados ya mapeados (`Todo`, `In Progress`, `Done`).
- El MCP de Plane conectado en la máquina de ejecución (confirmado funcionando en esta máquina vía `uvx`).
- Acceso de escritura al repo `VisionFramework` (`C:\Users\carri\OneDrive\Escritorio\Omnia\VisionFramework`), necesario **solo condicionalmente** (Paso 2, si el guess de PQL falla).
- Un nombre de work item reservado y no reutilizable para otra cosa: `zz-test-verify-plane-sync`. Si se necesita repetir esta verificación más de una vez (ej. tras un fix), puede sufijarse (`zz-test-verify-plane-sync-2`) para evitar colisión con un item de una corrida anterior que aún no se limpió — aunque lo correcto es siempre terminar con el Paso 7 (cleanup) antes de considerar la corrida cerrada.

## Comandos de Ejecución

No hay un comando único tipo `npm test`. La secuencia es los Pasos 0 a 9 de "Validación Manual", en orden, ejecutados como llamadas MCP directas y como invocaciones de `/plane-sync <operacion>` intercaladas — no como script de shell, ya que el punto central de esta verificación es que las llamadas MCP se hacen **desde dentro de la sesión de Claude Code**, no contra un endpoint HTTP externo.

Resumen de invocaciones por tipo:

```
# Llamadas MCP directas (herramientas):
mcp__plane__project(action=list)
mcp__plane__workitem(action=create|retrieve|list|delete, ...)
mcp__plane__state(action=list, ...)
mcp__plane__get_pql_reference()   # solo si el Paso 2 toma el camino de diagnóstico

# Invocaciones de la skill bajo prueba (Claude Code):
/plane-sync list-pending-tasks
/plane-sync mark-in-progress zz-test-verify-plane-sync
/plane-sync mark-done zz-test-verify-plane-sync

# Solo si el Paso 2 requiere fix (otro repo, no vision-infra):
git -C VisionFramework add skills/plane-sync.md
git -C VisionFramework commit -m "fix(plane-sync): ..."
```

## Resumen de Tests

| Paso | Cubre | Tipo |
|---|---|---|
| 0 | (precondición, bloquea todo) | MCP directo |
| 1 | AC-001 | MCP directo |
| 2 | AC-002, AC-003, AC-012, AC-013 | skill + MCP directo (+ git, condicional) |
| 3 | AC-004, AC-005 | skill + MCP directo |
| 4 | AC-006, AC-007 | skill + MCP directo |
| 5 | AC-008 | skill + MCP directo |
| 6 | AC-009 | skill + MCP directo |
| 7 | AC-010, AC-011 | MCP directo |
| 8 | AC-014 | inspección manual |
| 9 | AC-015 | inspección manual |

Total: 10 pasos manuales (Paso 0 sin AC propio, precondición), cubriendo los 15 criterios de aceptación de `2_acceptance-criteria.md`. La feature se considera completa (lista para `/onspecomplete`) solo cuando los 15 ACs pasan, con el Paso 7 (cleanup) como bloqueante absoluto: si el work item de prueba queda huérfano en el proyecto compartido `VINF`, la feature no está lista sin importar qué tan bien haya funcionado el resto de la verificación.
