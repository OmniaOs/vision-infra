---
name: executespec
description: 'Implementa una feature leyendo sus 4 archivos de spec, las specs relacionadas y el constitution. No hace preguntas; ejecuta directamente. Actualiza status a in-progress.'
---

# /executespec — Implementar Feature

Eres un agente ejecutando `/executespec` de Vision V2. Tu tarea es escribir el código de una feature cuya spec ya está escrita.

**No hagas preguntas al usuario durante la ejecución.** Solo ejecuta. Las instrucciones son lineales, numeradas y explícitas. Síguelas en orden.

Toda tu interacción y el código que escribes están en español (o en el idioma técnico natural del proyecto, para identificadores).

## Argumentos

`/executespec <feature-name>` — argumento obligatorio en kebab-case.

Si el usuario invoca `/executespec` **sin argumento**, aborta con el mensaje exacto:

```
Uso: /executespec <feature-name>
```

## Prerequisitos

Antes de hacer nada más, en este orden:

1. Busca una carpeta llamada exactamente `<feature-name>` recursivamente bajo `vision/specs/`. Si no la encuentras, aborta con:
   ```
   No encuentro vision/specs/.../<feature-name>/. Verifica el nombre o corre /newspec <feature-name>.
   ```

2. Dentro de esa carpeta, verifica que existen los 4 archivos:
   - `0_contract.md`
   - `1_spec.md`
   - `2_acceptance-criteria.md`
   - `3_test-plan.md`

   Si falta alguno, aborta con:
   ```
   Falta <archivo> en la spec de <feature-name>. Corre /newspec <feature-name> para completarla.
   ```

3. Verifica que existe `vision/constitution.md`. Si no existe, aborta con:
   ```
   No encuentro vision/constitution.md. Corre `vision init` primero.
   ```

## Pasos

Ejecuta estos pasos en orden. No omitas ninguno. No los reordenes.

### Paso 1 — Lee los 4 archivos de la feature

Lee completo cada uno, en este orden:

1. `0_contract.md` — entiende qué se construye, para quién y por qué.
2. `1_spec.md` — entiende cómo se construye: invariantes, modelo de datos, algoritmo, ejemplos de código, manejo de errores.
3. `2_acceptance-criteria.md` — entiende los criterios que el código debe cumplir al final.
4. `3_test-plan.md` — entiende qué tests vas a ejecutar.

### Paso 2 — Invoca la skill `find-related-specs`

Invócala con el argumento `<feature-name>`. El output es un markdown con un top 5 de specs relacionadas. Guárdalo.

Usa la invocación que corresponda a tu IDE:

| IDE | Invocación |
|-----|------------|
| Claude Code | `/find-related-specs <feature-name>` |
| Cursor | `@find-related-specs <feature-name>` |
| Windsurf | `@find-related-specs <feature-name>` |
| OpenCode | `/find-related-specs <feature-name>` |
| Antigravity | invocación programática según su convención |

### Paso 3 — Lee los contratos de las specs relacionadas

Para **cada** spec listada en el resultado del Paso 2:

- Lee su `0_contract.md`.
- **Solo el contrato.** No leas `1_spec.md`, ni `2_acceptance-criteria.md`, ni `3_test-plan.md` de esas specs relacionadas.
- Úsalo como contexto: entiende qué hace esa feature relacionada, qué archivos toca, qué dependencias declara.

### Paso 4 — Lee el constitution

Lee `vision/constitution.md` completo. Contiene el stack del proyecto, arquitectura, convenciones y módulos ya implementados.

### Paso 4.5 — Sincronizar tarea de ClickUp a "en desarrollo"

Antes de empezar a escribir código, invoca la skill `clickup-sync` para mover la tarea correspondiente al status mapeado como `in-progress`:

| IDE | Invocación |
|-----|------------|
| Claude Code | `/clickup-sync mark-in-progress <feature-name>` |
| Cursor | `@clickup-sync mark-in-progress <feature-name>` |
| Windsurf | `@clickup-sync mark-in-progress <feature-name>` |
| OpenCode | `/clickup-sync mark-in-progress <feature-name>` |
| Antigravity | invocación programática según convención |

La skill degrada silenciosamente si:

- ClickUp no está configurado en el constitution.
- El MCP de ClickUp no está disponible.
- No encuentra una tarea asociada a la feature.

**No bloquees la implementación** si la skill devuelve un caso especial. Anota el output (lo agregarás al mensaje final del Paso 8) y continúa al Paso 5.

### Paso 5 — Implementa el código

Con todo el contexto ya leído (Pasos 1–4), escribe el código de la feature siguiendo estas reglas en orden de prioridad:

1. **Fuente principal**: `1_spec.md` de la feature.
   - Su `## Algoritmo` te da los pasos.
   - Su `## Modelo de Datos` te da las interfaces y tipos.
   - Su `## Manejo de Errores` te da los códigos y mensajes.
   - Si tiene ejemplos de código / snippets / pseudocódigo en bloques fenced (```), **úsalos como guía literal**. No los reinterpretes.
2. **Convenciones del constitution**: naming, estructura de carpetas, estilo de imports, manejo de errores.
3. **Coherencia con specs relacionadas** (leídas en el Paso 3): si una spec relacionada declara una interfaz pública, úsala; no la reinventes.
4. **Archivos a tocar**: solo los que la sección `## Impacto` del `0_contract.md` indica. No crees archivos que la spec no menciona.
5. **Orden de implementación**: primero módulos de bajo nivel (helpers, utilidades), luego los de más alto nivel (orquestación, entry points).

**Regla de oro**: si dos fuentes se contradicen, gana **`1_spec.md`** de la feature target.

### Paso 6 — Ejecuta los tests

Según `3_test-plan.md`:

- Si el plan lista comandos de ejecución (ej: `npm test`, `vitest run`, `pytest`, etc.), ejecútalos exactamente como aparecen.
- **Si todos los tests pasan**, avanza al Paso 7.
- **Si al menos un test falla**, detente. Muestra al usuario el mensaje exacto:
  ```
  Implementación parcial de <feature-name>.
  Tests fallidos:
  - <test1>
  - <test2>
  Revisa los errores. El código quedó escrito pero el status sigue en pending.
  ```
  No hagas el Paso 7. No toques `vision-status.json`. Termina.

### Paso 7 — Actualiza `vision/vision-status.json`

Solo si los tests del Paso 6 pasaron todos:

1. Lee `vision/vision-status.json`.
2. Busca el entry cuyo `name` coincide con `<feature-name>`.
3. Cambia `status` de `pending` a `in-progress`.
4. Mantén `completedAt: null` (solo `/onspecomplete` lo cambia).
5. Actualiza `lastUpdated` a la fecha ISO 8601 actual (formato `"YYYY-MM-DDTHH:MM:SSZ"`).
6. Escribe el archivo de vuelta.

Si algo falla en este paso, muestra el error. No toques el código ya escrito.

### Paso 8 — Mensaje final

Muestra al usuario:

```
Implementación de <feature-name> completada.

Archivos creados/modificados:
- <path/a/archivo1>
- <path/a/archivo2>
- ...

Tests ejecutados: <N> pasaron, 0 fallaron.

Status actualizado a `in-progress`.

ClickUp: <output del Paso 4.5 — confirmación, "ya sincronizado", o aviso de no-op>

Siguiente paso: cuando valides que todo funciona en tu proyecto, corre /onspecomplete <feature-name> para marcarla como done.
```

Si el output de la skill `clickup-sync` en el Paso 4.5 fue uno de los casos especiales de no-op (Caso Especial 2/5/8), incluye esa línea tal cual la devolvió la skill. No la traduzcas ni la reformatees.

## Manejo de Errores

| Escenario | Acción |
|---|---|
| Argumento faltante | Aborta con mensaje de uso (ver "Argumentos") |
| Feature no existe | Aborta con mensaje dirigido (ver Prerequisitos 1) |
| Faltan archivos de spec | Aborta con mensaje dirigido (ver Prerequisitos 2) |
| Constitution ausente | Aborta con mensaje dirigido (ver Prerequisitos 3) |
| Tests fallan | Reporta, no actualiza status, termina (ver Paso 6) |
| Error al escribir código en un archivo | Reporta el error al usuario; **no** hagas rollback automático del resto |
| Error al escribir `vision-status.json` | Reporta el error; el código ya está escrito en disco |

## Mensaje Final

Ver Paso 8 (éxito) y Paso 6 (tests fallaron).

## Reglas Clave

Para ti, agente:

1. **No preguntes al usuario nada durante la ejecución.** Ejecutas directo.
2. **Lee primero, implementa después.** Completa los Pasos 1–4 antes de escribir una sola línea de código.
3. **La spec manda.** Si `1_spec.md` y el constitution se contradicen, gana `1_spec.md`.
4. **Si los tests fallan, te detienes.** No sigas implementando ni marques status.
5. **Solo tocas los archivos que la spec declara** (sección `## Impacto` del contrato).
6. **Idempotencia**: si un archivo ya existe con el contenido correcto, no lo reescribas innecesariamente.
7. **Los ejemplos de código en `1_spec.md` son guía literal**, no sugerencias.
