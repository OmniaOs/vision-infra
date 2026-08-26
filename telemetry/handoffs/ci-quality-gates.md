# Handoff: ci-quality-gates

> Al retomar en otra sesión/modelo/cuenta: `/resume ci-quality-gates`.

- **Fecha:** 2026-07-28 (continuación de sesión; el primer run real de CI en GitHub quedó registrado a las 11:46 UTC según logs)
- **Dev:** César (geonneitor)
- **Modelo y cuenta usados hasta ahora:** Claude Sonnet 5, sesión Claude Code interactiva
- **Rama git:** `feat/ci-quality-gates` (pusheada a `origin`, **PR #5 abierto** por César hacia `main`)
- **Estado del working tree:** limpio salvo `PLAN_VISIONFRAMEWORK (1).md` y `archive/` (untracked, preexistentes, no tocar — no son parte de esta tarea) y `telemetry/usage/geonneitor.jsonl` (untracked, log de sesión, ver más abajo)

## Objetivo de la tarea

Ejecutar la Fase 1 de `PLAN_VISIONFRAMEWORK (1).md` (sección 5, "Seguridad, CI y quality gates"), acotada a las Tareas 1.1 (GitHub Actions) y 1.3 (documentar protección de rama). La Tarea 1.2 (escribir pruebas faltantes para 75-90% de cobertura real) se excluyó a propósito — decisión explícita de César el 2026-07-28 — y queda como spec futura independiente.

Contexto previo relevante: antes de esto se auditó la Fase 0 completa (línea base + `vision doctor`), se arregló un bug real en `vision doctor` (PR #4, ya mergeado a `main`), y se instalaron los slash commands reales de Claude Code en este mismo repo (rama `feat/dogfood-claude-code-commands`, pusheada, sin PR abierto, decisión pendiente de César).

## Estado actual

**Implementación completa, PR #5 abierto, y esta vez sí se verificó en CI real de GitHub Actions** (no solo local). Eso expuso 3 bugs que las verificaciones locales no podían atrapar, ya corregidos:

1. **Inconsistencias post-auditoría** (`backlog.md`/`1_spec.md` en `pending` vs `vision-status.json`/`0_contract.md` en `in-progress`, checkboxes del Resumen Ejecutivo sin marcar, `CODEOWNERS` sin regla para `vision/specs/ci/`) → commit `4d38149`. De paso se limpió `telemetry/usage/geonneitor.jsonl` (log de sesión, no pertenece al PR) del commit WIP anterior — **sin tocar `telemetry/devs.json`**, que sí es compartido (solo tenía agregado el nombre `geonneitor` al roster).
2. **`package-lock.json` estaba en `.gitignore` desde el commit inicial del repo** → nunca existió en el remoto. Localmente `npm ci` "funcionaba" porque el archivo sí estaba en disco (solo no trackeado); en el checkout limpio de GitHub Actions no existe, y `setup-node@v4` con `cache: npm` fallaba con `Dependencies lock file is not found` en **todos** los jobs de la matriz. → commit `f992b48` (se sacó de `.gitignore` y se comiteó el lockfile real, verificado con `npm ci --dry-run`).
3. **`gitleaks/gitleaks-action@v2` exige licencia de pago para cuentas de organización** — `OmniaOs` es una org, el job `secret-scan` fallaba con `missing gitleaks license` antes de escanear nada. → commit `ec5b2f1` (se reemplazó el wrapper por el binario CLI oficial de gitleaks v8.30.1, descargado directo de sus releases con verificación de checksum — el CLI en sí es MIT y no tiene esa restricción, solo el wrapper de Action la agrega).

**Pendiente de confirmar:** si el run de CI con estos 3 fixes ya pasó en verde en los 5 jobs / toda la matriz.

## Decisiones tomadas (y por qué)

- **Alcance recortado a 1.1 + 1.3** (no 1.2) → decisión explícita de César.
- **Solo documentar la protección de rama, no aplicarla** → decisión explícita de César.
- **Umbrales de cobertura 45/70/65/45** en `vitest.config.ts` → piso de no-regresión calibrado sobre la cobertura real (~47%), no meta final.
- **`npm audit --audit-level=critical`, no `--audit-level=high`** → 5 `high` conocidas documentadas con expiración en `docs/AUDIT_EXCEPTIONS.md` (2026-10-26).
- **Categoría nueva `ci`** para esta spec → ninguna categoría existente encajaba.
- **Los 3 fixes de esta sesión se hicieron como commits nuevos**, no como amend/squash del commit WIP → la rama ya estaba pusheada con PR abierto; reescribir esa historia hubiera exigido un force-push innecesario para el beneficio marginal de un historial más limpio.
- **`package-lock.json` ahora se trackea en git** → no es opcional: es un requisito para que `npm ci` (el corazón mismo de esta spec) funcione en cualquier checkout limpio, no solo en la máquina de quien lo generó.
- **Se reemplazó `gitleaks-action` por el CLI directo en vez de pagar la licencia o quitar el job** → mismo motor gitleaks, mismo `detect` sobre todo el historial (`fetch-depth: 0`), sin costo ni dependencia de un secret de licencia externo.
- **Se agregó `/vision/specs/ci/` a `CODEOWNERS`** → decisión confirmada explícitamente por César, consistente con las demás categorías de specs que ya tenían dueño.
- **No se firma `Co-Authored-By: Claude` en ningún commit, y no se corre `gh pr create`** → regla explícita de César (guardada en memoria persistente).

## Archivos tocados

- `vision/specs/ci/ci-quality-gates/{0_contract,1_spec,2_acceptance-criteria,3_test-plan}.md` — spec completa, status `in-progress` (commit `d47e456`, sesión anterior).
- `.github/workflows/ci.yml`, `.github/scripts/check-spec-structure.mjs`, `tests/unit/ci/check-spec-structure.test.ts`, `vitest.config.ts`, `docs/BRANCH_PROTECTION.md`, `docs/AUDIT_EXCEPTIONS.md`, `CODEOWNERS`, `vision/backlog.md`, `vision/vision-status.json` — implementación original (commit `d47e456`, sesión anterior).
- `vision/backlog.md`, `vision/specs/ci/ci-quality-gates/1_spec.md`, `CODEOWNERS` — fixes post-auditoría (commit `4d38149`, esta sesión).
- `.gitignore`, `package-lock.json` — lockfile requerido por `npm ci` en Actions (commit `f992b48`, esta sesión).
- `.github/workflows/ci.yml` — gitleaks CLI directo en vez del wrapper con licencia (commit `ec5b2f1`, esta sesión).

## Próximos pasos (en orden)

1. Confirmar que el run de CI con los 3 fixes de esta sesión pasó en verde (los 5 jobs, matriz Windows/Linux × Node 18/20 incluida).
2. **⚠️ Pendiente real detectado, sin corregir todavía:** `vision/specs/ci/ci-quality-gates/1_spec.md` (líneas 34, 67, 106-116, 331) sigue documentando `gitleaks/gitleaks-action@v2` como la implementación — quedó desactualizado respecto al `ci.yml` real tras el commit `ec5b2f1`. Correr `/modifyspec ci-quality-gates` para actualizar esa sección ("el CÓMO") antes de mergear.
3. Si CI pasa en verde y César aprueba el PR #5: mergear.
4. Correr `/onspecomplete ci-quality-gates` para cerrar el ciclo (constitution + backlog checkbox + status `done`).
5. Cuando César decida, aplicar manualmente la protección de rama descrita en `docs/BRANCH_PROTECTION.md`.
6. Pendiente aparte, sin relación de bloqueo: decidir qué hacer con la rama `feat/dogfood-claude-code-commands`.
7. Futuro (no ahora): spec propia para la Tarea 1.2 (subir cobertura real de 47% hacia 75-90%).

## Gotchas / NO hacer

- **No confundir `vision doctor` hoy con "todo perfecto"**: sigue reportando WARN en Network sin túnel SSH — esperado, no es un bug.
- **No volver a agregar `package-lock.json` a `.gitignore`** — es un requisito de `npm ci` en CI, no un artefacto de build; si alguien lo revierte "por costumbre", los 5 jobs de la matriz vuelven a fallar todos a la vez.
- **Si en el futuro `gitleaks-action` deja de exigir licencia para orgs, no hace falta revertir el fix** — el CLI directo es igual de válido y evita depender de un secret de licencia externo.
- **`1_spec.md` tiene drift respecto al código real** (ver Próximos pasos #2) — no es un bug de implementación, es documentación de spec desactualizada tras el fix de gitleaks.
- **El script `check-spec-structure.mjs` lee `vision-status.json` tolerando tanto la clave `specs` como `features`** — discrepancia de esquema preexistente, detectada pero no corregida (fuera de alcance).
- **`vision init` interactivo en `cli-install-smoke`** se resuelve con `printf '\n' | npx vision init ...` — no quitar ese `printf`, o el job se cuelga en CI.
- **No correr `gh pr create` ni firmar `Co-Authored-By`** — preparar rama + commit y parar ahí.
- **No mezclar la Tarea 1.2** en este PR — fuera de alcance por decisión de César.
