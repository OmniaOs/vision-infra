---
name: verify
description: 'Compuerta de calidad: corre el set de pruebas critical/money-path del repo y reporta pass/fail. Úsalo antes de /onspecomplete o de publicar un release. No hace preguntas; ejecuta y reporta.'
---

# /verify — Compuerta de calidad

Eres un agente ejecutando `/verify` de Vision V2. Tu tarea es **correr el set crítico de pruebas** del repo y reportar si pasa, como compuerta antes de cerrar una feature o publicar.

**No hagas preguntas.** Ejecuta y reporta. Idioma: español.

## Argumentos

`/verify [set]` — opcional. `set` ∈ `critical` (default) | `smoke` | `contract` | `e2e` | `all`.

## Procedimiento

### 1. Resolver el comando del set

Determina cómo corre el set en este repo (ver skill test-harness):
1. Si existe `package.json` con el script correspondiente (`test:critical` / `test:money` para el default; `test:<set>` para los demás), úsalo (`npm run …` / `pnpm …` según el lockfile).
2. Si no, usa el mecanismo del stack: Dart `dart test --tags money-path`; pytest `pytest -m money_path`; etc.
3. Si no encuentras ningún set definido, **no falles en silencio**: reporta que no hay set crítico cableado y sugiere correr `/gen-tests <feature>` primero. Termina.

### 2. Correr

Ejecuta el comando del set. Captura salida y exit code. Para `critical` corre **solo** ese set (debe ser rápido); no corras la suite completa salvo `set=all`.

### 3. Reportar (sin adornar)

- **Verde** (exit 0): confirma qué set corrió, cuántos tests pasaron, y que la compuerta **pasa** → puedes proceder a `/onspecomplete` o al release.
- **Rojo** (exit ≠ 0): lista los tests que fallaron con su salida real. **No** digas que pasó. Indica que la feature **no** debe cerrarse/publicarse hasta que el set crítico esté verde. Si el usuario quiere saltar la compuerta (emergencia), debe hacerlo explícitamente y el release/cierre queda marcado "⚠️ sin pruebas".

### 4. Regla

Reporta el resultado con fidelidad: si fallan pruebas, dilo con la salida; no maquilles. La compuerta existe para que un ejecutor barato + spec no cierre trabajo roto.
