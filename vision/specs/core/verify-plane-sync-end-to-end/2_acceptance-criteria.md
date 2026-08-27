# Criterios de Aceptación: Verificar plane-sync end-to-end

## Metadata

```yaml
feature: verify-plane-sync-end-to-end
version: 1
last_updated: 2026-08-27
```

## Resumen Ejecutivo

Total de criterios: **15**, agrupados en 7 categorías:

1. Creación y visibilidad del work item de prueba (AC-001 a AC-003)
2. Transición a `in-progress` e idempotencia (AC-004 a AC-007)
3. Transición a `done` (AC-008 a AC-009)
4. Cleanup y estado final del workspace (AC-010 a AC-011)
5. Gap del filtro PQL — corrección cross-repo (AC-012 a AC-013)
6. Gap de la Estrategia 3 (custom-field) — registro, no resolución (AC-014)
7. Metodología de verificación (AC-015)

Todos los criterios se verifican manualmente, mediante llamadas MCP reales a `plane` — ver `3_test-plan.md`. No hay un runner automatizado que ejecute estos ACs (constitution: `Testing: ninguno configurado todavía`).

---

## 1. Creación y visibilidad del work item de prueba

### AC-001: El work item de prueba se crea exitosamente en el proyecto VINF

**Given** el MCP de Plane está conectado y `project_id: "ca75c562-081c-4236-904d-b403484dcf7d"` (VINF) está confirmado,
**When** se invoca `mcp__plane__workitem({action: "create", project_id: "ca75c562-081c-4236-904d-b403484dcf7d", name: "zz-test-verify-plane-sync", ...})`,
**Then** la respuesta incluye un `id` (UUID) y un `identifier` humano (ej. `VINF-N`) sin error, y el estado inicial del work item corresponde al estado mapeado como `pending` ("Todo") del proyecto.

### AC-002: El item de prueba aparece en `list-pending-tasks` (directamente, o tras corregir el PQL)

**Given** el work item `zz-test-verify-plane-sync` existe en el estado mapeado a `pending`,
**When** se invoca `/plane-sync list-pending-tasks`,
**Then** la tabla de salida incluye una fila con el `identifier` y `name` del item creado en AC-001. Si la primera ejecución no lo incluye, este AC solo se considera pasado después de aplicar el fix de PQL descrito en AC-012/AC-013 y volver a ejecutar la operación.

### AC-003: `list-pending-tasks` refleja el proyecto y el `status_map` reales del constitution

**Given** el bloque `plane:` de `vision/constitution.md` (`project_id: ca75c562-081c-4236-904d-b403484dcf7d`, `status_map.pending: "Todo"`),
**When** se invoca `list-pending-tasks`,
**Then** el encabezado del output indica `Proyecto: ca75c562-081c-4236-904d-b403484dcf7d · Estado pendiente mapeado: Todo` — consistente con el constitution, no un valor hardcodeado ni de otro proyecto.

---

## 2. Transición a `in-progress` e idempotencia

### AC-004: `mark-in-progress` cambia el estado real en Plane

**Given** el work item de prueba está en el estado `"Todo"`,
**When** se invoca `/plane-sync mark-in-progress zz-test-verify-plane-sync`,
**Then** una llamada independiente `mcp__plane__workitem({action: "retrieve", workitem_id: "<uuid>"})` muestra `state` == UUID del estado `"In Progress"` — no basta con leer el mensaje de éxito de la skill (ver INV-2).

### AC-005: El mensaje de la skill reporta correctamente la transición

**Given** la transición de AC-004 tuvo éxito,
**When** se lee el output de `mark-in-progress`,
**Then** el formato coincide con `transition-success` de `plane-sync.md` (`## Plane sincronizado`, con `identifier` y nombres de estado anterior/target correctos).

### AC-006: Reinvocar `mark-in-progress` reporta idempotencia

**Given** el item ya está en `"In Progress"` (post AC-004),
**When** se invoca `/plane-sync mark-in-progress zz-test-verify-plane-sync` una segunda vez, sin cambios externos entre medio,
**Then** el output coincide con el formato `already-in-target-status` de `plane-sync.md`.

### AC-007: La idempotencia es real, no solo textual

**Given** la segunda invocación de AC-006,
**When** se compara `updated_at` del work item (vía `retrieve`) antes y después de esa segunda invocación,
**Then** el valor es idéntico — confirma que no hubo una llamada `workitem action="update"` redundante (INV-6), no solo que el mensaje "sonó" idempotente.

---

## 3. Transición a `done`

### AC-008: `mark-done` cambia el estado real a Done

**Given** el work item está en `"In Progress"`,
**When** se invoca `/plane-sync mark-done zz-test-verify-plane-sync`,
**Then** una llamada independiente de `retrieve` confirma `state` == UUID del estado `"Done"`.

### AC-009: `mark-done` también respeta idempotencia si se reinvoca

**Given** el item ya está en `"Done"`,
**When** se invoca `mark-done` nuevamente sobre el mismo item,
**Then** el output es `already-in-target-status` y `updated_at` no cambia — mismo patrón de verificación que AC-006/AC-007, aplicado a la transición final.

---

## 4. Cleanup y estado final del workspace

### AC-010: El work item de prueba se elimina al finalizar

**Given** todas las transiciones (AC-004 a AC-009) fueron verificadas,
**When** se invoca `mcp__plane__workitem({action: "delete", workitem_id: "<uuid>"})` con el UUID guardado en el Paso 1 de `1_spec.md`,
**Then** una llamada posterior de `retrieve` (o de `list` sobre el proyecto) confirma que el item ya no existe en `VINF`.

### AC-011: El workspace queda sin residuos de esta verificación

**Given** el cleanup de AC-010 se ejecutó,
**When** se lista el proyecto `VINF` completo (o se filtra por el prefijo `zz-test-`),
**Then** no queda ningún work item de prueba asociado a esta verificación — ni el original ni duplicados accidentales de reintentos fallidos (Escenario G de `0_contract.md`).

---

## 5. Gap del filtro PQL — corrección cross-repo

### AC-012: El gap del filtro PQL queda resuelto o confirmado

**Given** el Paso 5 de `VisionFramework/skills/plane-sync.md` marcaba la sintaxis del filtro `pql` como "no se ha podido confirmar",
**When** se ejecuta esta verificación end-to-end contra Plane real (Paso 2 de `1_spec.md`),
**Then**, o bien (a) se confirma que el guess original funciona y se elimina la nota de incertidumbre de ese punto específico del archivo, o (b) se corrige la sintaxis real y se actualiza el archivo — en ambos casos, la nota "no se ha podido confirmar" del Paso 5 deja de estar vigente al terminar esta verificación.

### AC-013: Si hubo fix, se commiteó en el repo correcto

**Given** el gap de AC-012 se resolvió con un cambio de código (camino (b)),
**When** se revisa el commit resultante,
**Then** vive en el repo **`VisionFramework`** (no en `vision-infra`), y su mensaje referencia esta spec de `vision-infra` como el motivo de la verificación — consistente con INV-4 de `1_spec.md`.

---

## 6. Gap de la Estrategia 3 (custom-field) — registro, no resolución

### AC-014: El gap de la Estrategia 3 queda registrado aunque no resuelto

**Given** `task_match.method: "by-name"` en `vision-infra` (esta verificación no ejercita naturalmente la Estrategia 3 de `resolveWorkitem`),
**When** se completa esta spec (Paso 7 de `1_spec.md`),
**Then** existe un registro explícito — en el Historial de Cambios de `1_spec.md`, o en `0_contract.md` → Notas de Implementación — de que ese segundo gap ("no se ha podido confirmar" sobre lectura de propiedad personalizada vía `expand`/`fields`) sigue sin confirmar, y de por qué no se cierra en esta spec (INV-5).

---

## 7. Metodología de verificación

### AC-015: Toda la verificación usó llamadas MCP reales, no simuladas

**Given** el requisito explícito de esta spec de no mockear resultados (INV-7 de `1_spec.md`),
**When** se revisa la ejecución completa (AC-001 a AC-011),
**Then** cada paso tiene asociado el output crudo real de una llamada `mcp__plane__*` (no una descripción de memoria ni un resultado inventado) — análogo al criterio de "Definición de Hecho" usado en `expose-metrics-hub-domain/2_acceptance-criteria.md`.

---

## Cobertura del Contrato

| Sección del contrato (`0_contract.md`) | ACs que la cubren |
|---|---|
| Escenario A (happy path) | AC-001, AC-002, AC-004, AC-006, AC-008, AC-010 |
| Escenario B (guess de PQL incorrecto) | AC-012, AC-013 |
| Escenario C (mensaje de la skill no confiable) | AC-004, AC-008 |
| Escenario D (idempotencia falsa) | AC-006, AC-007, AC-009 |
| Escenario E (cleanup incompleto) | AC-010, AC-011 |
| Escenario F (MCP no disponible) | AC-015 (no se marcan ACs sin evidencia real) |
| Escenario G (basura preexistente) | AC-011 |
| Alcance → No incluye: Estrategia 3 | AC-014 |
| Invariante INV-2 (verificación independiente) | AC-004, AC-008 |
| Invariante INV-3 / INV-8 (cleanup obligatorio) | AC-010, AC-011 |
| Invariante INV-4 (fix en el repo correcto) | AC-013 |
| Invariante INV-6 (idempotencia real) | AC-006, AC-007, AC-009 |
| Invariante INV-7 (sin datos simulados) | AC-015 |

## Notas

- No hay criterios sobre "performance" o "carga" — esta es una verificación puntual de un flujo de sincronización de estado, no un test de volumen.
- **AC-011 y AC-013 son, en conjunto, los criterios más importantes de todo el set**: AC-011 porque un cleanup incompleto deja basura visible en el workspace compartido de todo el equipo de Omnia (no solo de `vision-infra`); AC-013 porque un fix aplicado en el repo equivocado (`vision-infra` en vez de `VisionFramework`) no llegaría a ningún otro repo que use la skill compartida, dejando el gap real sin cerrar pese a que localmente "parecería" resuelto.
- AC-014 es deliberadamente un criterio de **registro**, no de resolución — pasa aunque el gap de Estrategia 3 siga abierto, siempre que quede documentado. No confundir "criterio cumplido" con "gap cerrado" en ese caso particular.
- Los criterios de esta sección se verifican en el orden en que aparecen en `3_test-plan.md` (que sigue el orden del Algoritmo de `1_spec.md`), no necesariamente en el orden AC-001…AC-015.
- Ningún criterio de este set requiere modificar código de `vision-infra` (`gateway/`, `memory/`, `metrics-hub/`) — si al verificar algún AC pareciera necesario, es señal de que la implementación se desvió del alcance de `0_contract.md`.
- Todos los criterios son verificables por una sola persona con el MCP de Plane conectado, salvo AC-013 si el fix requiere revisión/aprobación en `VisionFramework` según las convenciones de ese repo (no asumidas aquí).

## Definición de "Hecho" para esta feature

Esta feature se considera completa (lista para cerrar con `/onspecomplete verify-plane-sync-end-to-end`) únicamente cuando se cumplen **todas** las siguientes condiciones simultáneamente:

1. Los 15 criterios de aceptación (AC-001 a AC-015) pasan en una ejecución real contra el proyecto `VINF` en `management.omniaos.ai`, no en un entorno simulado.
2. El work item de prueba `zz-test-verify-plane-sync` (o cualquier variante creada durante reintentos) fue borrado — AC-010 y AC-011 confirmados con una llamada `list`/`retrieve` posterior, no de memoria.
3. El estado del gap de PQL (confirmado sin cambios, o corregido) quedó registrado en `1_spec.md` — no queda como una pregunta abierta implícita para quien lea la spec después.
4. Si hubo fix de PQL, el commit correspondiente existe y es localizable en el repo `VisionFramework` (AC-013).
5. El gap de la Estrategia 3 quedó explícitamente registrado como abierto (AC-014) — no se omite ni se da por resuelto sin haberlo verificado.

Si alguna de estas cinco condiciones no se cumple, la feature permanece en `in-progress` (o vuelve a `pending`) hasta resolverla — no se marca `done` de forma parcial.

Quien ejecute `/onspecomplete` sobre esta feature debe poder mostrar, para cada AC, el output real de la llamada MCP correspondiente (no una descripción de memoria de "sí funcionó") — eso es lo que distingue una verificación de integración real de una simplemente declarada como terminada.
