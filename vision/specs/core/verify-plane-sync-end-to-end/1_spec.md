# Especificación Técnica: Verificar plane-sync end-to-end

## Metadata

```yaml
status: pending
version: 1
last_updated: 2026-08-27
category: core
```

## Historial de Cambios

- [ADDED] 2026-08-27: Versión inicial de la especificación.

Esta es la versión 1 — sin cambios posteriores todavía. Cuando se ejecute esta spec (`/executespec`), el resultado de la verificación del gap de PQL (Paso 7 del Algoritmo) debe registrarse aquí como una entrada `[CHANGED]` o `[ADDED]` nueva, vía `/modifyspec`, indicando si el guess original quedó confirmado sin cambios o si se corrigió (y en tal caso, referenciando el commit del repo `VisionFramework` donde se aplicó el fix).

## Naturaleza de Este Documento

Esta spec describe un **runbook de verificación operativa**, no la implementación de un módulo de `vision-infra`. No hay clases, funciones ni archivos nuevos de aplicación en este repo — el "algoritmo" de abajo son llamadas MCP concretas ejecutadas por un agente contra el proyecto `VINF` real en Plane, en el orden exacto en que un usuario real ejercitaría `plane-sync` a través de los workflows del framework (`/executespec`, `/onspecomplete`).

Se mantiene la estructura estándar de `1_spec.md` (invariantes, modelo, algoritmo, manejo de errores) porque la precisión que exige una verificación contra un sistema externo real es exactamente la misma que exigiría código nuevo — cada paso debe ser reproducible y su resultado, verificable con evidencia (el output crudo de una llamada MCP), no de memoria. Quien retome esta spec vía `/executespec` debe leer "Algoritmo" como una secuencia de llamadas a herramientas MCP reales, ejecutadas con la participación de un humano con el MCP de Plane conectado — **no** como pseudocódigo a simular. Si el MCP no está disponible al momento de ejecutar, la respuesta correcta es reportar la feature como bloqueada (ver Escenario F de `0_contract.md`), nunca fingir que los pasos se corrieron.

## Invariantes

- **INV-1**: El work item de prueba usado en esta verificación es identificable sin ambigüedad como descartable — nombre exacto `zz-test-verify-plane-sync`. El prefijo `zz-test-` está reservado para work items de test de este tipo de verificación dentro del proyecto `VINF`; nunca se reutiliza para trabajo real.
- **INV-2**: Toda afirmación sobre el estado de un work item en esta verificación se respalda releyendo el work item real vía `mcp__plane__workitem` (`action: "retrieve"` o `"retrieve_by_identifier"`) — nunca confiando únicamente en el texto de salida de la skill `plane-sync` (ver Escenario C de `0_contract.md`, que es exactamente el fallo que este invariante previene).
- **INV-3**: El work item de prueba se borra (`mcp__plane__workitem`, `action: "delete"`) al final de la ejecución, sin importar si la verificación fue exitosa o no. Ninguna corrida de esta verificación debe dejar basura permanente en el workspace compartido `omnia`.
- **INV-4**: Cualquier corrección a la sintaxis del filtro PQL (Escenario B) se commitea en el repo **`VisionFramework`** (`skills/plane-sync.md`), nunca en `vision-infra`. `vision-infra` no es dueño de ese archivo — solo lo consume.
- **INV-5**: La Estrategia 3 de `resolveWorkitem` (fallback por propiedad personalizada) no se ejercita como parte del alcance de esta spec, porque `task_match.method: "by-name"` en `vision-infra` nunca entra a esa rama de código. Cualquier corrección a esa estrategia queda fuera de esta spec — solo se registra como gap conocido (ver Paso 7 del Algoritmo).
- **INV-6**: Invocar `mark-in-progress` (o `mark-done`) dos veces seguidas sobre el mismo work item, sin cambios externos entre medio, produce exactamente **una** llamada real a `workitem action="update"` (la primera) y **cero** en la segunda. Esto se verifica comparando el campo `updated_at` del work item antes y después de la segunda invocación — no alcanza con que el mensaje de la skill diga `already-in-target-status` (ver Escenario D de `0_contract.md`).
- **INV-7**: Ninguna llamada de esta verificación usa datos simulados, mockeados o inventados. Todas son llamadas MCP reales contra el proyecto `VINF` (`project_id: ca75c562-081c-4236-904d-b403484dcf7d`) en `management.omniaos.ai`.
- **INV-8**: El cleanup (INV-3) no depende de que todos los pasos anteriores hayan salido bien. Si la verificación se aborta a mitad de camino por cualquier motivo (Escenario F), el work item de prueba creado hasta ese punto igual debe borrarse antes de cerrar la sesión de trabajo.

Estas ocho invariantes son la referencia contra la que se valida cada AC de `2_acceptance-criteria.md`.

## Stack Técnico

- **Servidor MCP**: `plane`, conectado vía `uvx` en esta máquina (`C:\Users\carri\.local\bin\uvx.exe`). Expone ~30 herramientas; las relevantes para esta spec son `mcp__plane__workitem`, `mcp__plane__state`, `mcp__plane__project` y `mcp__plane__get_pql_reference`.
- **Skill bajo prueba**: `VisionFramework/skills/plane-sync.md`, versión posterior al commit `34df830` ("feat(sync): reemplazar integración ClickUp por Plane"). Expone tres operaciones (`list-pending-tasks`, `mark-in-progress`, `mark-done`) invocadas como `/plane-sync <operacion> [<feature-name>]` en Claude Code.
- **Proyecto Plane objetivo**: `Vision Infra` (identificador `VINF`), `project_id: ca75c562-081c-4236-904d-b403484dcf7d`, dentro del workspace `omnia` en `management.omniaos.ai`.
- **Configuración consumida** (no modificada por esta spec): bloque `## Integración Plane` de `vision/constitution.md` de este repo — `status_map: {pending: "Todo", in-progress: "In Progress", done: "Done"}`, `task_match: {method: "by-name", custom_field_name: null}`.
- Sin dependencias nuevas de código, sin paquetes npm/pip nuevos — todo el "stack" de esta feature son llamadas a herramientas ya conectadas.

## Modelo de Datos

No hay entidades de aplicación nuevas. El modelo relevante son las formas de datos que el MCP de Plane devuelve y que esta verificación debe leer con cuidado (documentadas aquí en forma de interfaces TypeScript por claridad, aunque no se implementa ningún tipo en código):

```typescript
interface PlaneState {
  id: string;          // UUID — lo que exige el campo `state` de un work item
  name: string;         // ej. "Todo", "In Progress", "Done"
  project_id: string;
}

interface PlaneWorkItem {
  id: string;            // UUID interno — usado en action="retrieve"/"update"/"delete"
  identifier: string;    // identificador humano, ej. "VINF-7" — usado en retrieve_by_identifier
  name: string;
  state: string;         // UUID de un PlaneState — NO un nombre en texto
  project_id: string;
  updated_at: string;    // ISO 8601 — la señal usada para detectar updates redundantes (INV-6)
}

// Registro que el ejecutor de esta spec debe llevar durante el runbook,
// para poder cerrar cada AC con evidencia real en vez de una descripción
// de memoria (ver "Definición de Hecho" en 2_acceptance-criteria.md).
interface VerificationLogEntry {
  paso: string;                 // ej. "Paso 3 — mark-in-progress"
  llamadaMcp: string;           // ej. 'mcp__plane__workitem({action:"retrieve", workitem_id:"<uuid>"})'
  outputCrudo: string;          // la respuesta real de la llamada, sin resumir
  acCubiertos: string[];        // ej. ["AC-004", "AC-005"]
}
```

Notas sobre este modelo:

- `PlaneState.id` es el valor que hay que resolver antes de comparar o escribir un `state` — Plane, a diferencia de ClickUp, no acepta el nombre del estado como string en un update (esto ya lo resuelve el helper `resolveStateId` del Paso 4 de `plane-sync.md`, que esta spec no reimplementa ni vuelve a verificar por separado — se da por confiable porque no está entre los dos puntos marcados como "no se ha podido confirmar").
- `PlaneWorkItem.updated_at` es el campo clave de toda la verificación de idempotencia (INV-6): es la única señal disponible, sin acceso a logs del servidor MCP, para distinguir "la skill decidió no llamar `update`" de "la skill llamó `update` mandando el mismo valor que ya estaba" — ambos casos dejarían el `state` final idéntico, pero solo el primero es el comportamiento correcto documentado en la Regla Clave 2 de `plane-sync.md`.
- `VerificationLogEntry` no es un tipo que se implemente en código — es la forma sugerida de tomar notas durante la ejecución del Algoritmo (Paso 1 a Paso 7), para que el Paso 9 de `3_test-plan.md` ("Revisión de evidencia") tenga algo concreto que inspeccionar en vez de depender de la memoria de quien ejecutó la verificación.

## Alternativas Consideradas

Documentado brevemente para que quien retome esta spec entienda por qué se eligió este enfoque y no otro:

1. **No verificar nada, confiar en la lectura del código de `plane-sync.md`.** Descartado: es exactamente la situación previa a esta spec — la skill ya fue "leída" y considerada razonable por su propio autor, que sin embargo dejó dos puntos marcados explícitamente como no confirmados contra un MCP real. Una lectura de código no sustituye una ejecución real cuando la duda es sobre el comportamiento de un sistema externo (Plane), no sobre la lógica interna de la skill.
2. **Construir la matriz completa de 6 fixtures** que ya usa `VisionFramework/vision/specs/skills/skill-plane-sync/3_test-plan.md` (`fixture-no-plane`, `fixture-disabled`, `fixture-incomplete`, `fixture-valid-byname`, `fixture-valid-bycf`, `fixture-stale-status-map`). Descartado para esta spec: esa suite ya existe y es responsabilidad del repo dueño de la skill (`VisionFramework`); reconstruirla aquí duplicaría trabajo y ampliaría el alcance mucho más allá de lo que `vision-infra` necesita confirmar (un proyecto real, un método de match, el flujo real de tres operaciones).
3. **Forzar artificialmente la Estrategia 3 (`by-custom-field`)** cambiando temporalmente `task_match.method` en el constitution solo para esta verificación, y revirtiéndolo después. Descartado: alteraría la configuración real del repo (aunque sea temporalmente) para probar un camino de código que `vision-infra` nunca usa en producción, y el riesgo de dejar la config a medio revertir (o de que un `mark-in-progress` real corra durante la ventana de la prueba con la config alterada) no se justifica frente al beneficio de cerrar un gap que ni siquiera aplica a este repo. Se prefiere señalar el gap (AC-014) y dejarlo para quien configure `by-custom-field` en otro repo, donde sí sea parte del flujo real.
4. **Verificación dirigida contra el proyecto `VINF` real, con un work item de prueba desechable (elegida).** Ejercita exactamente el camino de código que `vision-infra` usa en producción (`by-name`, proyecto `VINF`, las tres operaciones en su orden natural de uso por los workflows del framework), sin alterar configuración persistente, y con un costo de limpieza acotado a un solo work item borrado al final. Es el balance correcto entre "verificación real, no simulada" (INV-7) y "no ensuciar ni el workspace de Plane ni la config del repo" (INV-3, INV-8).

## Algoritmo

Runbook a ejecutar en orden por quien corra `/executespec verify-plane-sync-end-to-end`, con el MCP de Plane conectado.

### Paso 0 — Prerrequisitos

1. Confirmar que el MCP de Plane está conectado (ej. una llamada de bajo riesgo como `mcp__plane__project` con `action: "list"` para confirmar que `VINF` aparece con el `project_id` esperado).
2. Confirmar que el repo `VisionFramework` (`C:\Users\carri\OneDrive\Escritorio\Omnia\VisionFramework`) está disponible localmente con working tree limpio — se necesitará **solo si** el Escenario B ocurre (Paso 2b).
3. Revisar si ya existe un work item con nombre `zz-test-verify-plane-sync` (o similar) en `VINF`, de una corrida anterior sin cleanup (Escenario G de `0_contract.md`). Si existe, borrarlo antes de continuar.
4. Si el MCP no está disponible → detener aquí, reportar la feature como bloqueada (Escenario F). No simular los pasos siguientes.

### Paso 1 — Crear el work item de prueba

```
mcp__plane__workitem({
  action: "create",
  project_id: "ca75c562-081c-4236-904d-b403484dcf7d",
  name: "zz-test-verify-plane-sync",
  description: "Work item de prueba temporal para la spec verify-plane-sync-end-to-end de vision-infra. Seguro borrar/ignorar. Ver vision-infra/vision/specs/core/verify-plane-sync-end-to-end/."
})
```

Guardar de la respuesta: `id` (UUID interno) e `identifier` (ej. `VINF-N`). Ambos se usan en todos los pasos siguientes. Confirmar (AC-001) que el estado inicial corresponde al mapeado como `pending` ("Todo").

### Paso 2 — `list-pending-tasks` y diagnóstico del filtro PQL

1. Invocar `/plane-sync list-pending-tasks`.
2. **Caso (a) — el item aparece**: el guess de PQL del Paso 5 de `plane-sync.md` (`state = "<uuid>"` o equivalente) era correcto. No se requiere ningún cambio de código. Anotar este resultado para el Paso 7.
3. **Caso (b) — el item no aparece, o la llamada MCP subyacente falla**:
   1. Invocar `mcp__plane__get_pql_reference` (si está disponible) para obtener la sintaxis real soportada por el servidor.
   2. Probar manualmente `mcp__plane__workitem` con `action: "list"`, `project_id: "ca75c562-081c-4236-904d-b403484dcf7d"` y el `pql` corregido, hasta confirmar que devuelve el item de prueba.
   3. Editar `VisionFramework/skills/plane-sync.md` — Paso 5, punto 3: reemplazar el filtro `pql` guesseado por la sintaxis real confirmada, y quitar la nota "no se ha podido confirmar" de ese punto específico (dejar el resto de la nota, sobre el gap de Estrategia 3, intacta — ese es un gap distinto, ver Paso 7).
   4. Commitear el cambio **en el repo `VisionFramework`**, con un mensaje que referencie esta spec de `vision-infra` como motivo (ej. `fix(plane-sync): corrige sintaxis PQL del filtro por estado, verificado en vision-infra/verify-plane-sync-end-to-end`).
   5. Volver a invocar `/plane-sync list-pending-tasks` para confirmar que ahora sí incluye el item de prueba.

### Paso 3 — `mark-in-progress` y verificación independiente

1. Invocar `/plane-sync mark-in-progress zz-test-verify-plane-sync`.
2. Leer el mensaje de salida — debe coincidir con el formato `transition-success` de `plane-sync.md`.
3. **No confiar en el paso anterior.** Verificar independientemente:
   ```
   mcp__plane__workitem({ action: "retrieve", workitem_id: "<uuid guardado en Paso 1>" })
   ```
   Confirmar que `state` (UUID) coincide con el UUID del estado `"In Progress"` del proyecto `VINF` (obtenible con `mcp__plane__state({ action: "list", project_id: "ca75c562-081c-4236-904d-b403484dcf7d" })` y comparando por `name`).
4. Guardar el `updated_at` de esta respuesta — se usa en el Paso 4 para verificar idempotencia real.

### Paso 4 — Reinvocar `mark-in-progress` (idempotencia)

1. Invocar `/plane-sync mark-in-progress zz-test-verify-plane-sync` una segunda vez, sin ningún cambio externo entre medio.
2. El mensaje de salida debe coincidir con el formato `already-in-target-status`.
3. Verificar independientemente con `retrieve` que `updated_at` **no cambió** respecto al valor guardado en el Paso 3.4 — esta es la prueba de que no hubo una llamada `update` redundante (INV-6), no solo que el texto de salida "sonó" idempotente.

### Paso 5 — `mark-done` y verificación final

1. Invocar `/plane-sync mark-done zz-test-verify-plane-sync`.
2. Verificar independientemente con `retrieve` que `state` (UUID) coincide con el UUID del estado `"Done"` del proyecto.
3. Opcional pero recomendado: repetir el patrón del Paso 4 (reinvocar `mark-done` una vez más) para confirmar que la idempotencia también se sostiene en la transición a `done`, no solo en la transición a `in-progress`.

### Paso 6 — Cleanup

```
mcp__plane__workitem({ action: "delete", workitem_id: "<uuid guardado en Paso 1>" })
```

Confirmar el borrado con una llamada posterior (`retrieve` debe fallar/devolver no-encontrado, o el item ya no debe aparecer en un `list` del proyecto). Este paso es obligatorio (INV-3/INV-8) incluso si algún paso anterior falló — no dejar el work item de prueba huérfano en el workspace compartido.

### Paso 7 — Registrar el resultado

1. Si el Paso 2 tomó el camino (b) (fix de PQL), agregar una entrada `[CHANGED]` al "Historial de Cambios" de este mismo `1_spec.md` (vía `/modifyspec`, versión 2), referenciando el commit real en `VisionFramework`. Si tomó el camino (a) (guess confirmado sin cambios), agregar igualmente una entrada `[ADDED]`/`[CHANGED]` breve dejando constancia de que se confirmó sin necesidad de fix — para que quien lea esta spec después no tenga que volver a preguntarse si ese gap sigue abierto.
2. Registrar explícitamente, en la misma entrada o en `0_contract.md` → Notas de Implementación, que el gap de la Estrategia 3 (`resolveWorkitem` por propiedad personalizada) **sigue sin confirmar** — no se cierra en esta spec (INV-5) — para que quede visible para quien configure `task_match.method: "by-custom-field"` en otro repo más adelante.
3. Si se ejecuta `/onspecomplete verify-plane-sync-end-to-end` tras completar todo lo anterior, su mensaje final de cierre es también un lugar razonable para dejar constancia del resultado — pero no sustituye la actualización del Historial de Cambios del punto 1.

### Paso 8 — Manejo de bloqueo

Si en cualquier punto el MCP de Plane deja de responder, o las credenciales expiran, o el proyecto `VINF` deja de ser accesible: detener la ejecución, ejecutar igualmente el Paso 6 (cleanup) si el work item de prueba ya se creó, y reportar la feature como bloqueada con el detalle del error — nunca marcar ACs como pasados sin evidencia real (INV-7).

## Manejo de Errores

| Código / Señal | Escenario | Comportamiento esperado / Mensaje | Acción |
|---|---|---|---|
| Error en `workitem action="create"` | MCP no conectado, o `project_id` inválido | La llamada devuelve un error explícito de la herramienta | Confirmar conexión con `mcp__plane__project({action:"list"})` antes de reintentar; si sigue fallando, tratar como Escenario F (bloqueo) |
| `list-pending-tasks` no incluye el item de prueba pese a existir en estado `pending` | Guess de PQL incorrecto (Escenario B) | Caso Especial 6 de `plane-sync.md` (error MCP), o una tabla vacía/incompleta pese a haber un pending real | Ejecutar el Paso 2(b) del Algoritmo: diagnosticar con `get_pql_reference`, corregir y commitear en `VisionFramework` |
| `mark-in-progress` reporta `transition-success` pero `retrieve` muestra el estado sin cambiar | Bug real en la skill o en el mapeo `status_map`, o discrepancia entre el mensaje y la realidad (Escenario C) | El mensaje de la skill no es confiable por sí solo | No continuar al Paso 4 dando por bueno el resultado; investigar antes — esto invalida la verificación de AC-004 hasta resolverse |
| La segunda invocación de `mark-in-progress` NO reporta `already-in-target-status` (dispara `update` de nuevo) | Falla de idempotencia (viola INV-6 y la Regla Clave 2 de `plane-sync.md`) | `updated_at` cambia en la segunda llamada | Reportar como bug real de la skill (no de esta verificación); no cerrar AC-006/AC-007 como pasados |
| `workitem action="delete"` falla | Permisos insuficientes, o UUID guardado incorrecto | El item de prueba queda huérfano en `VINF` (Escenario E) | Reintentar con el UUID correcto del Paso 1; si sigue fallando, borrar manualmente desde la UI web de Plane y dejar constancia de que se hizo fuera del flujo MCP |
| Ya existe un work item `zz-test-verify-plane-sync` al empezar (Escenario G) | Corrida anterior sin cleanup completo | `resolveWorkitem` por nombre podría matchear el equivocado o devolver ambigüedad (Caso Especial 8 de `plane-sync.md`) | Limpiar manualmente el/los item(s) preexistentes en el Paso 0.3 antes de crear uno nuevo |
| La Estrategia 3 de `resolveWorkitem` nunca se ejercita | `task_match.method: "by-name"` en `vision-infra` (comportamiento esperado, no un error) | Gap conocido, explícitamente fuera de alcance (INV-5) | Registrar en el Paso 7 del Algoritmo; no bloquea el cierre de esta feature |
| El MCP se desconecta a mitad de la verificación | Timeout, expiración de sesión, etc. | La verificación queda incompleta | Ejecutar igualmente el cleanup (Paso 6) del work item ya creado si aplica; reportar bloqueado (Paso 8), reintentar la verificación completa en otra sesión |

## Resumen Ejecutivo

Checklist de implementación (a ejecutar por quien corra `/executespec verify-plane-sync-end-to-end` con el MCP de Plane conectado):

- [ ] Confirmar MCP de Plane conectado y proyecto `VINF` accesible (Paso 0).
- [ ] Confirmar que no hay work items `zz-test-*` preexistentes de una corrida anterior sin cleanup (Paso 0.3).
- [ ] Crear el work item de prueba `zz-test-verify-plane-sync` en `VINF` (Paso 1).
- [ ] Ejecutar `list-pending-tasks`; si el item no aparece, diagnosticar y corregir el filtro PQL **en `VisionFramework`** (Paso 2).
- [ ] Ejecutar `mark-in-progress`; verificar el cambio de estado real vía `retrieve` (Paso 3).
- [ ] Reinvocar `mark-in-progress`; confirmar idempotencia real (`already-in-target-status` + `updated_at` sin cambios) (Paso 4).
- [ ] Ejecutar `mark-done`; verificar el estado final vía `retrieve` (Paso 5).
- [ ] Borrar el work item de prueba — obligatorio, sin excepciones (Paso 6).
- [ ] Registrar el resultado del gap de PQL (confirmado o corregido) y dejar constancia explícita de que el gap de Estrategia 3 sigue abierto (Paso 7).
- [ ] Correr `/onspecomplete verify-plane-sync-end-to-end` una vez validado todo lo anterior.

Nota final: cada casilla debe cerrarse con el output real de una llamada MCP (o el commit real, en el caso del fix de PQL), no de memoria — ver "Definición de Hecho" en `2_acceptance-criteria.md`.

Nota adicional para quien retome esta spec en otra sesión o desde otra máquina: si el MCP de Plane no está conectado todavía, ese setup (instalar `uv`/`uvx`, resolver el MCP en la configuración de Claude Code) no está documentado en ningún archivo de este repo al momento de escribir esta spec — no asumir que `DEPLOY_COOLIFY.md` lo cubre (es documentación del VPS de producción, no de tooling local de desarrollo). Confirmarlo con Daniel antes de invertir tiempo reconstruyéndolo a ciegas.
