---
name: test-harness
description: 'Convenciones del harness de pruebas de Vision: sets por categoría (critical/money-path, smoke, contract, e2e, flaky), etiquetado por stack, scripts runner, y cómo los tests salen de los acceptance-criteria del spec. Úsalo en /gen-tests y /verify.'
---

# Test Harness — convenciones

Los tests en Vision **salen del spec** (`2_acceptance-criteria.md` → tests) y se organizan en **sets por categoría** para poder correr una **compuerta rápida** (`/verify`) sin la suite completa. Idea central: un ejecutor barato guiado por un spec fuerte produce código confiable **solo si** hay tests que verifican los criterios; la compuerta impide cerrar/publicar trabajo roto.

## Categorías de set

| Set | Qué cubre | Regla |
|---|---|---|
| **critical / money-path** | Rutas **irreversibles o de dinero/datos**: checkout, cobros, cortes de caja, permisos, borrados, migraciones, mutaciones a producción | **Obligatorio.** Todo criterio de una ruta money-path debe tener test. Es lo que corre la compuerta. |
| **contract** | Contratos entre componentes: shape de API, tipos, serialización, DTOs | Test cuando un cambio de una parte puede romper otra |
| **smoke** | Arranque + rutas felices básicas | Barato, corre siempre |
| **e2e** | Flujos completos punta a punta | Suelen correr aparte (más lentos) |
| **flaky** | Tests inestables conocidos | Aíslalos con este tag para **excluirlos** del gate hasta estabilizarlos |

**money-path es la designación más importante.** Al generar tests, primero identifica qué acceptance-criteria tocan rutas irreversibles o de dinero y garantiza su cobertura.

## Etiquetado por stack

- **Dart/Flutter**: `@Tags(['money-path'])` sobre el test + `dart_test.yaml` declarando los tags. Correr: `dart test --tags money-path`.
- **Node/TS (Vitest/Jest)**: agrupa por archivo o `describe` por categoría, o usa `test.each`/nombres con prefijo (`[money-path]`); corre por set con scripts o `--project`/`--dir`.
- **Python (pytest)**: `@pytest.mark.money_path` (registra el marker en `pytest.ini`). Correr: `pytest -m money_path`.
- Otro stack: usa su mecanismo nativo de filtrado/tags; lo importante es poder correr **un set aislado**.

## Scripts runner (compuerta rápida)

Cablea comandos que corran cada set por separado. Convención (adáptala al stack):

- `test:critical` (alias `test:money`) — solo money-path. **Este es el que corre `/verify` y el `pre-push` de guardrails.** Debe ser rápido.
- `test:smoke`, `test:contract`, `test:e2e` — por categoría.
- `test:all` — todo menos `flaky`.

En Node van en `package.json`. En otros stacks, documéntalos en `3_test-plan.md` (sección "Sets y comandos").

## Del spec a los tests

1. Cada **acceptance-criterion** (`2_acceptance-criteria.md`) → ≥1 test, con nombre trazable (`AC-003_...`).
2. Clasifica cada uno en un set (arriba).
3. Criterio ambiguo → test `skip`/`todo` con comentario `TODO: AC-XXX ambiguo`, no lo inventes.
4. Registra los sets/comandos al final de `3_test-plan.md`.

## Self-check de cableado (opcional)

Un script `scripts/verify-harness.mjs` puede validar **barato** (sin correr la suite) que el harness esté cableado: que existan los scripts de set, que las rutas money-path declaradas tengan tests etiquetados, y que la compuerta esté conectada. Útil en CI como chequeo previo. No corre pruebas; solo verifica configuración/etiquetado y sale 1 si falta algo bloqueante.

## Compuerta y guardrails

`/verify` corre el set critical antes de `/onspecomplete` o de un release. El módulo **guardrails** trae un `pre-push` que corre el set crítico (`test:critical`/`test:money`) y **bloquea el push** si falla — enforcement de máquina de la misma regla. Saltar la compuerta debe ser explícito y marca el trabajo "⚠️ sin pruebas".
