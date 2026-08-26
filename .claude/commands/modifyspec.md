---
name: modifyspec
description: 'Modifica una feature existente interpretando la descripción del cambio que el usuario da inline. Identifica archivos afectados, agrega delta markers, incrementa version. No hace rondas de preguntas; ejecuta directamente.'
---

# /modifyspec — Modificar Spec de Feature

Eres un agente ejecutando `/modifyspec` de Vision V2. Tu tarea es aplicar cambios a una feature existente cuya spec ya fue escrita.

**No hagas rondas de preguntas.** Como máximo **una** pregunta de clarificación si la descripción del cambio es ambigua. Pasos lineales, imperativos.

Todo en español.

## Argumentos

`/modifyspec <feature-name> <descripción del cambio>`

Ambos son obligatorios. La descripción viene inline en el mismo mensaje; puede ser una línea o varios párrafos, puede incluir código, ejemplos, referencias a archivos/folders/imágenes.

Si el usuario no pasa argumentos:
```
Uso: /modifyspec <feature-name> <descripción del cambio>
```

Si solo hay `<feature-name>` sin descripción:
```
Falta la descripción del cambio. Uso: /modifyspec <feature-name> <descripción>
```

## Prerequisitos

1. Busca recursivamente bajo `vision/specs/` una carpeta llamada `<feature-name>`. Si no existe:
   ```
   No encuentro vision/specs/.../<feature-name>/. Verifica el nombre o corre /newspec <feature-name>.
   ```

2. Verifica que dentro existen los 4 archivos: `0_contract.md`, `1_spec.md`, `2_acceptance-criteria.md`, `3_test-plan.md`. Si falta alguno:
   ```
   Falta <archivo> en la spec de <feature-name>. Corre /newspec <feature-name> para completarla.
   ```

## Pasos

### Paso 1 — Leer el estado actual

Lee en memoria:
- Los 4 archivos de la feature.
- `vision/constitution.md`.
- `vision/vision-status.json`.

Guarda **snapshots** de los 4 archivos de la feature y de `vision-status.json` para rollback.

### Paso 2 — Invocar `find-related-specs`

Invoca la skill con `<feature-name>`. Guarda el top 5 con `relevance`.

Invocación por IDE:

| IDE | Invocación |
|-----|------------|
| Claude Code | `/find-related-specs <feature-name>` |
| Cursor | `@find-related-specs <feature-name>` |
| Windsurf | `@find-related-specs <feature-name>` |
| OpenCode | `/find-related-specs <feature-name>` |
| Antigravity | invocación programática según su convención |

### Paso 3 — Leer contratos de las specs relacionadas

Para cada spec listada en el resultado del Paso 2, lee **solo su `0_contract.md`** (no la spec completa, no los criterios, no el test plan). Contexto para advertir sobre impactos.

### Paso 4 — Clasificar el cambio

Lee la descripción del usuario. Clasifícala según esta tabla para determinar qué archivo(s) modificar:

| Tipo de cambio | Archivo(s) afectado(s) |
|---|---|
| Alcance (incluye/no incluye) | `0_contract.md` |
| Dependencias | `0_contract.md` |
| Escenarios | `0_contract.md` |
| User stories / Propósito | `0_contract.md` |
| Modelo de datos / interfaces | `1_spec.md` (+ habitual: `2_acceptance-criteria.md` + `3_test-plan.md`) |
| Algoritmo / pasos | `1_spec.md` |
| Invariantes | `1_spec.md` |
| Manejo de errores | `1_spec.md` (+ `2_acceptance-criteria.md` si aplica) |
| Stack técnico | `1_spec.md` (+ a veces `3_test-plan.md`) |
| Criterios de aceptación | `2_acceptance-criteria.md` |
| Estrategia de testing / tests | `3_test-plan.md` |

Si la descripción **no mapea claramente** a ninguna entrada, haz UNA pregunta de clarificación:

```
Para aplicar el cambio necesito saber: ¿qué archivo(s) debo modificar?
a) 0_contract.md (alcance / dependencias / escenarios)
b) 1_spec.md (modelo / algoritmo / invariantes / errores)
c) 2_acceptance-criteria.md (criterios)
d) 3_test-plan.md (estrategia / tests)
Responde con la letra (o letras separadas por coma).
```

Si tras la respuesta sigue ambiguo, aborta:
```
No pude determinar qué archivo modificar con la descripción dada. Cancelado.
```

### Paso 5 — Verificar coherencia del cambio

Antes de modificar, verifica que el cambio descrito es coherente con el estado actual:
- Si pide "remover X" y X no existe, aborta con mensaje específico.
- Si pide "cambiar Y de A a B" y Y ya está en B, aborta indicando.

### Paso 6 — Aplicar los cambios a los archivos identificados

Para cada archivo afectado:

1. Modifica su contenido según la descripción del usuario. Preserva estilo y estructura canónica.
2. Si agregas contenido nuevo, va al final de la sección correspondiente; si modificas contenido existente, mantén el resto intacto.

### Paso 7 — Delta marker en el `1_spec.md`

**Siempre** (sin importar qué archivo se haya cambiado), agrega al `## Historial de Cambios` del `1_spec.md` una línea nueva:

```
- [<MARKER>] YYYY-MM-DD: <descripción del cambio en 1-2 líneas, mencionando archivo(s) afectado(s) y nueva version>.
```

`<MARKER>`:
- `[MODIFIED]` para cambios generales.
- `[ADDED]` cuando lo principal fue agregar.
- `[REMOVED]` cuando lo principal fue eliminar.

### Paso 8 — Incrementar version del `1_spec.md`

En la metadata del `1_spec.md`:
- `version: <N+1>` para cambio normal.
- `version: <N+2>` si el cambio es mayor (menciónalo en el delta marker como "cambio mayor").

### Paso 9 — Actualizar fechas en archivos modificados

- `0_contract.md`: `updated: YYYY-MM-DD` si fue modificado.
- `1_spec.md`: `last_updated: YYYY-MM-DD` (siempre, porque siempre se agrega delta marker).
- `2_acceptance-criteria.md`: `last_updated: YYYY-MM-DD` si fue modificado.
- `3_test-plan.md`: `last_updated: YYYY-MM-DD` si fue modificado.

### Paso 10 — No tocar el status

**No modifiques** `status`, `completedAt` ni `position` en `vision-status.json`. Preserva el entry de la feature tal cual.

### Paso 11 — Actualizar solo `lastUpdated` en `vision-status.json`

Solo el campo raíz `lastUpdated` a fecha ISO 8601 completa (`YYYY-MM-DDTHH:MM:SSZ`).

### Paso 12 — Escribir los archivos

Orden:
1. Archivos modificados de la spec (numérico ascendente: `0_contract.md`, `1_spec.md`, `2_acceptance-criteria.md`, `3_test-plan.md`).
2. `vision/vision-status.json`.

Si cualquiera falla: restaura todos desde los snapshots del Paso 1 y reporta:
```
Error al escribir <archivo>: <detalle>. Rollback aplicado — todo quedó como antes.
```

### Paso 13 — Advertir sobre specs relacionadas

Si el resultado del Paso 2 incluía specs con `relevance ≥ 0.50` (distintas de la feature actual), añade al mensaje final:

```
Advertencia: estas specs podrían verse afectadas por el cambio. Considera correr /modifyspec sobre ellas si aplica:
- <spec-1> (relevance 0.XX)
- <spec-2> (relevance 0.XX)
```

**No las modificas**; solo adviertes.

### Paso 14 — Mensaje final

```
/modifyspec aplicado sobre <feature-name>.

Archivos modificados:
- <archivo1> (updated YYYY-MM-DD)
- <archivo2> (updated YYYY-MM-DD)

1_spec.md: version <N+1>, delta marker [<MARKER>] agregado al historial.

<Advertencia sobre specs relacionadas, si aplica>

Siguiente paso: si cambió la spec técnica o el modelo de datos, corre /executespec <feature-name> para re-implementar.
```

## Delta Markers y Versionado

En el `## Historial de Cambios` del `1_spec.md`:

```
- [MODIFIED] YYYY-MM-DD: <descripción>.
- [ADDED] YYYY-MM-DD: <descripción de lo añadido>.
- [REMOVED] YYYY-MM-DD: <descripción de lo eliminado>.
```

Reglas:
- Cada `/modifyspec` agrega una línea al historial.
- El historial es acumulativo; no sobrescribas líneas viejas.
- `version` del `1_spec.md` se incrementa en `+1` por cambio normal, `+2` por cambio mayor (marker debe indicar "cambio mayor").

## Manejo de Errores

| Escenario | Acción |
|---|---|
| Falta `feature-name` | Aborta con mensaje de uso |
| Falta descripción | Aborta con mensaje extendido |
| Feature no existe | Aborta, sugiere verificar o `/newspec` |
| Faltan archivos de spec | Aborta, sugiere `/newspec` |
| Descripción ambigua | 1 pregunta de clarificación; si sigue ambigua, aborta |
| Cambio contradictorio con estado actual | Aborta con mensaje dirigido |
| Falla escritura | Rollback completo desde snapshots, reporta |

## Mensaje Final

Ver Paso 14.

## Reglas Clave

Para ti, agente:

1. **No hagas rondas de preguntas.** Máximo UNA clarificación.
2. **Siempre agregas delta marker al `## Historial de Cambios` del `1_spec.md`**, sin importar qué archivo cambiaste.
3. **Siempre incrementas `version` del `1_spec.md`**.
4. **No cambias status**, `completedAt`, ni `position` de la feature.
5. **No ejecutas código ni tests**.
6. **Transaccionalidad completa**: snapshot al inicio, rollback de todo si algo falla.
7. **Adviertes sobre specs relacionadas** si `relevance ≥ 0.50`, pero no las modificas tú.
