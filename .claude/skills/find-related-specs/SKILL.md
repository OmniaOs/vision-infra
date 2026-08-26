---
name: find-related-specs
description: 'Encuentra specs existentes relacionadas con una feature dada por similitud de tokens y dependencias directas. Úsalo antes de crear o modificar una spec.'
---

# Find Related Specs

## Propósito

Cuando un agente está a punto de crear una spec nueva (`/newspec`) o modificar una existente (`/modifyspec`), necesita saber qué specs del proyecto podrían estar relacionadas. Este skill recorre `vision/specs/` y devuelve una lista rankeada de las 5 specs más relevantes al nombre de feature recibido.

Usa este skill siempre como paso previo a proponer el nombre final de una nueva feature. Te ayuda a detectar duplicación, reutilización potencial y dependencias cruzadas.

## Entrada

Recibes un único argumento:

- **`featureName`** (string en kebab-case): el nombre propuesto de la feature a crear o modificar. Ejemplos válidos: `user-authentication`, `billing-reports`, `checkout-flow`.

Si el argumento no viene en formato kebab-case (solo `[a-z0-9-]+`), detén la ejecución y devuelve el output del Caso Especial 3.

## Algoritmo

Ejecuta los siguientes pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Verificar existencia de vision/

1. Verifica si existe el directorio `vision/` en la raíz del proyecto.
2. Si **no existe** → devuelve el output del Caso Especial 1 y termina.

### Paso 2 — Recolectar contratos

1. Busca recursivamente todos los archivos que coincidan con el glob `vision/specs/**/0_contract.md`.
2. Para cada archivo encontrado, registra:
   - **`specName`**: nombre del directorio padre del archivo. Ejemplo: si el archivo está en `vision/specs/commands/vision-init/0_contract.md`, entonces `specName = "vision-init"`.
   - **`dependencies`**: lista de dependencias declaradas en el bloque YAML de metadata. Busca la línea `dependencies:` dentro del primer bloque de código YAML (delimitado por triples backticks con la etiqueta `yaml`). Si el valor es una cadena tipo `"cli-core, template-system"`, separa por coma y trim cada elemento. Si es `"none"` (case-insensitive) o está vacío, la lista es `[]`.
   - **`purpose`**: la primera oración del bloque `## Propósito`. Una "oración" termina en `.`, `!` o `?` seguido de espacio o salto de línea. Trunca a 120 caracteres; si se trunca, añade `…` al final.
3. Si un contrato no tiene metadata YAML o no tiene `## Propósito`, **sáltalo silenciosamente** y continúa con los siguientes. No lo incluyas en resultados.
4. Si no se recolecta ningún contrato válido → devuelve el output del Caso Especial 2 y termina.

### Paso 3 — Tokenizar

Define la función `tokenize(s)` que aplicas a `featureName` y a cada `specName`:

1. Convierte `s` a lowercase.
2. Split por el carácter `-`.
3. Filtra elementos vacíos del resultado (pueden surgir de guiones consecutivos como `auth--api`).
4. Filtra las stopwords fijas: `["a", "the", "of", "and", "or", "de", "la", "el", "los", "las", "y", "o"]`.
5. Devuelve el conjunto de tokens únicos (sin duplicados).

Aplica `tokenize` a `featureName` → `T_input`.
Aplica `tokenize` a cada `specName` → `T_spec`.

### Paso 4 — Calcular relevancia por cada spec

Para cada spec recolectada X:

1. **Boost por dependencia directa**:
   - Si `featureName` aparece literalmente en `X.dependencies` → `relevance(X) = 1.00`, marca `reason = "Dependencia directa"`, salta al siguiente.
   - Si ya existe una spec con el mismo nombre que `featureName` y `X.specName` aparece literalmente en las dependencias de esa spec → `relevance(X) = 1.00`, marca `reason = "Dependencia directa"`, salta al siguiente.
2. **Similitud Jaccard** (si no aplicó boost):
   - `intersection = |T_input ∩ T_spec|`
   - `union = |T_input ∪ T_spec|`
   - Si `union = 0` → `relevance = 0.00`
   - Si no → `relevance = intersection / union`, redondear a 2 decimales usando half-up (`0.335` → `0.34`, `0.324` → `0.32`)
   - `reason = null`

### Paso 5 — Filtrar y ordenar

1. Descarta specs con `relevance < 0.30`.
2. Descarta la spec cuyo `specName` es literalmente igual a `featureName` (no te auto-sugieras al modificar).
3. Ordena descendentemente por `relevance`.
4. En caso de empate exacto, ordena alfabéticamente ascendente por `specName`.
5. Toma los primeros 5 elementos.

### Paso 6 — Formatear salida

Si la lista final está vacía → devuelve el output del Caso Especial 2.
Si tiene al menos 1 elemento → devuelve el output del formato principal.

## Formato de Salida

### Formato principal (hay resultados)

Devuelve exactamente este bloque markdown, reemplazando los placeholders `<...>` con los valores reales:

```
### Related Specs for "<featureName>"

1. **<specName>** (relevance: <relevance>)<sufijo_razon>
   <purpose>

2. **<specName>** (relevance: <relevance>)<sufijo_razon>
   <purpose>

...
```

Reglas estrictas del formato:

- `<relevance>` siempre con **2 decimales explícitos**: `1.00`, `0.67`, `0.30`. Nunca `1`, `.67`, `0.3` o `0.670`.
- `<sufijo_razon>` es ` — Dependencia directa` si `reason === "Dependencia directa"`. Si `reason === null`, el sufijo es cadena vacía (nada).
- `<purpose>` va indentado con **exactamente 3 espacios** y en línea aparte de la línea numerada.
- Entre cada ítem hay **una línea en blanco**.
- La lista se numera del 1 al N, con N ≤ 5.
- Si el propósito supera 120 caracteres, trunca a 119 y agrega `…`.

## Casos Especiales

### Caso Especial 1 — `vision/` no existe

Devuelve exactamente:

```
### Related Specs for "<featureName>"

vision/ directory not found — cannot search for related specs.
```

### Caso Especial 2 — Ningún resultado relevante

Se activa cuando: `vision/specs/` existe pero está vacío, no hay contratos válidos, o ninguna spec alcanza `relevance ≥ 0.30`.

Devuelve exactamente:

```
### Related Specs for "<featureName>"

No related specs found for "<featureName>".
```

### Caso Especial 3 — `featureName` inválido

Se activa cuando `featureName` no cumple `[a-z0-9-]+` o está vacío.

Devuelve exactamente:

```
### Related Specs for "<featureName>"

Invalid featureName format. Expected kebab-case ([a-z0-9-]+).
```
