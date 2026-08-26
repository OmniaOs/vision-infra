---
name: gen-tests
description: 'Genera un set de pruebas para una feature a partir de sus acceptance-criteria y test-plan, organizado por categorías (critical/money-path, smoke, contract, e2e) en el framework de test nativo del repo, y cablea los scripts runner. No hace preguntas; ejecuta directamente.'
---

# /gen-tests — Generar set de pruebas desde el spec

Eres un agente ejecutando `/gen-tests` de Vision V2. Tu tarea es **escribir las pruebas** que verifican una feature cuyo spec ya existe, organizadas en **sets por categoría**, en el framework de testing nativo del repo.

**No hagas preguntas al usuario.** Ejecuta en orden. Idioma: español (identificadores en el idioma técnico natural del repo).

## Argumentos

`/gen-tests <feature-name>` — obligatorio, kebab-case.

Si se invoca sin argumento, aborta con el mensaje exacto:

```
Uso: /gen-tests <feature-name>
```

## Prerequisitos

1. Debe existir `vision/specs/**/<feature-name>/` con al menos `2_acceptance-criteria.md`. Si no existe, aborta indicando que primero corras `/newspec <feature-name>`.

## Procedimiento

### 1. Leer el spec

Lee, si existen: `2_acceptance-criteria.md` (fuente principal — cada criterio debe volverse ≥1 test), `3_test-plan.md` (estrategia, casos TC-*, sets), `1_spec.md` (comportamiento) y el `constitution.md`. Usa el skill **test-harness** para las convenciones de sets y etiquetado.

### 2. Detectar el stack de testing (no re-preguntar)

Inspecciona el repo y determina el framework y la ubicación de tests:
- Node/TS → Vitest/Jest (`*.test.ts`, `vitest.config.*`), scripts en `package.json`.
- Dart/Flutter → `test/`, `dart_test.yaml`, `@Tags([...])`.
- Python → `pytest` (`tests/`, marcadores `@pytest.mark.*`).
- Otro → usa el que el repo ya use; si no hay ninguno, elige el idiomático y créalo mínimo.

### 3. Clasificar los criterios en sets

Mapea cada acceptance-criterion a una **categoría de set** (ver skill test-harness):
- **critical / money-path**: rutas irreversibles o de dinero/datos (checkout, cortes, permisos, pagos, borrados). **Obligatorio** que tengan test.
- **contract**: contratos de API/tipos/serialización entre componentes.
- **smoke**: que arranca / rutas felices básicas.
- **e2e**: flujos completos (marca `e2e`; suelen correr aparte).
- **flaky**: aísla los inestables con su tag para excluirlos del gate.

### 4. Generar los tests etiquetados

Para cada criterio, escribe el/los test(s) en el framework detectado, **etiquetados por su categoría** con el mecanismo nativo (tags de `dart_test.yaml`, `describe`/`test.concurrent` + convención de nombre o `test.each` en Vitest, `@pytest.mark.money_path`, etc.). Un test por criterio como mínimo; nómbralos trazables al criterio (ej. `AC-003_...`). No inventes comportamiento no especificado; si un criterio es ambiguo, escribe el test como `skip`/`todo` con un comentario `// TODO: criterio AC-XXX ambiguo`.

### 5. Cablear los runners por set

Asegura scripts/targets que corran cada set por separado. Convención (adáptala al stack):
- `test:critical` (o `test:money`) — solo el set critical/money-path (rápido, es la **compuerta**).
- `test:smoke`, `test:contract`, `test:e2e` — por categoría.
- `test:all` — todo menos `flaky`.

En Node, agrégalos a `package.json`. En Dart, documenta los comandos `dart test --tags money-path`. Registra la lista de sets/comandos al final de `3_test-plan.md` (sección "Sets y comandos").

### 6. Reporte

Imprime: framework detectado, cuántos tests generaste por categoría, qué criterios quedaron `skip`/`todo`, y los comandos de cada set. Recuerda al usuario correr **`/verify`** para pasar la compuerta antes de `/onspecomplete`.
