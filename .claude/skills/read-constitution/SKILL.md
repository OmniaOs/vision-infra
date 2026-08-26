---
name: read-constitution
description: 'Lee vision/constitution.md y devuelve sus secciones como contexto para el workflow invocador. Soporta cualquier estructura de secciones personalizada por el usuario — parser genérico sin esquema fijo.'
---

# Read Constitution

## Propósito

Cuando un workflow (`/newspec`, `/executespec`, `/modifyspec`) necesita contexto del proyecto antes de actuar, invoca este skill. El skill lee `vision/constitution.md` y devuelve todas sus secciones H2 tal como el usuario las escribió.

**Parser genérico sin esquema fijo**: este skill no asume que la constitución tenga secciones específicas (ni `Stack Técnico`, ni `Convenciones`, ni ninguna otra). Detecta dinámicamente cualquier H2 presente y devuelve su contenido literal. Esto permite que cada proyecto personalice su constitución según su dominio (backend, diseño, datos, etc.) sin restringirse a un esquema impuesto por el framework.

El workflow invocador es responsable de interpretar las secciones presentes. Si busca información específica, debe iterar por los títulos o hacer búsqueda fuzzy. El skill **no interpreta ni transforma** el contenido.

## Entrada

Recibes opcionalmente:

- **`projectRoot`** (string, path absoluto): directorio raíz del proyecto. Default: directorio de trabajo actual del agente.

No recibes ningún otro argumento. El skill siempre lee el archivo ubicado en `<projectRoot>/vision/constitution.md`.

## Algoritmo

Ejecuta los siguientes pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Verificar existencia

1. Verifica si existe `<projectRoot>/vision/constitution.md`.
2. Si **no existe** → devuelve el output del Caso Especial 1 (archivo ausente) y termina.

### Paso 2 — Leer el archivo

1. Lee el contenido completo como UTF-8.
2. Si la lectura falla por encoding o permisos → devuelve el output del Caso Especial 4 (error de lectura) y termina.
3. Si el archivo tiene 0 bytes o solo whitespace → marca `isEmpty = true` y salta al Paso 5.

### Paso 3 — Extraer frontmatter (opcional)

1. Si las primeras líneas del archivo forman un bloque delimitado por `---` (exactamente 3 guiones en línea sola al inicio, y un segundo `---` más adelante también en línea sola), extrae el contenido intermedio como YAML.
2. Intenta parsear el YAML:
   - Si el parseo falla → `projectName = null`, continúa sin error.
   - Si parsea y contiene clave `project_name` → `projectName = <valor>`.
   - Si parsea y no tiene `project_name` pero sí `name` → `projectName = <valor>`.
   - Si parsea pero no tiene ninguna de esas claves → `projectName = null`.
3. El resto del archivo (después del segundo `---`) es el `body` que se procesa en el Paso 4.
4. Si el archivo no empieza con `---` en la primera línea, todo el archivo es `body` y `projectName = null`.

### Paso 4 — Detectar secciones H2

Define `sections` como una **lista ordenada** (no un mapa/objeto) de entradas con forma `{ title, content }`.

1. Divide el `body` por líneas (preservando líneas en blanco).
2. Itera línea por línea.
3. Una línea es un **H2** si y solo si cumple el regex: `^##\s+(.+?)\s*$`
   - Exactamente 2 caracteres `#` al inicio de la línea.
   - Al menos un espacio después.
   - Contenido capturado no vacío (grupo 1 del regex).
4. `###`, `####`, `#####`, `######` **NO son H2**. Se tratan como contenido de la sección H2 anterior.
5. Para cada línea que sea H2:
   - Registra `title = <grupo 1 del regex>` y el índice de la línea.
6. Después de recorrer todas las líneas, computa el rango de contenido de cada H2:
   - Para el H2 en línea `L_i`, el contenido va desde la línea `L_i + 1` hasta la línea `L_{i+1} - 1` (o hasta EOF si es el último H2).
   - Junta esas líneas preservando saltos de línea internos.
   - Aplica `trim` solo al inicio y final del bloque (no a cada línea individual).
7. Agrega `{ title, content }` a `sections` en el orden en que fueron encontrados.

### Paso 5 — Validar estado y formatear salida

1. Si `sections.length === 0` y archivo existe → devuelve el output del Caso Especial 2 (archivo vacío).
2. Si `sections.length >= 1`:
   - Detecta títulos duplicados contando cuántas veces aparece cada `title` literal (comparación case-sensitive).
   - Para cada título con más de 1 ocurrencia, genera una línea de warning para el header.
   - Devuelve el output del formato principal con las secciones en orden original, y el header con `projectName`, `Sections detected: <n>`, y los warnings si los hay.

## Formato de Salida

### Formato principal (archivo existe con al menos 1 sección)

Devuelve exactamente este bloque markdown, reemplazando los placeholders con los valores reales:

```
### Constitution Context (vision/constitution.md)

- Project name: <projectName o "N/A">
- File found: yes
- Sections detected: <n>
<lineas_de_warning>

---

#### <title_1>
<content_1>

#### <title_2>
<content_2>

...
```

Reglas estrictas del formato:

- Si `projectName` es `null` → imprime literalmente `N/A` en el campo.
- `<lineas_de_warning>` son 0 o más líneas con formato: `- Warning: duplicate section title "<titulo>" detected (<count> occurrences).`. Si no hay duplicados, no incluyas ninguna línea en ese bloque (ni siquiera línea en blanco extra).
- El separador `---` aparece **una vez**, entre el header y el primer contenido de sección.
- Los títulos de sección se prefijan con `####` (H4), no con `##`. Razón: el skill debe poder contener H2 y H3 en el contenido de una sección sin colisionar con los delimitadores.
- El `<content>` se imprime **literal**, sin transformación. Si contiene H3, bloques de código, listas, tablas: todo se preserva tal cual.
- Entre secciones hay **una línea en blanco**.

### Formato Caso Especial 1 — archivo no existe

```
### Constitution Context (vision/constitution.md)

- File found: no

El proyecto no tiene constitution.md inicializado. Sugiere al usuario correr `vision init`, o crear manualmente `vision/constitution.md` antes de continuar.
```

### Formato Caso Especial 2 — archivo vacío o sin H2

```
### Constitution Context (vision/constitution.md)

- Project name: <projectName o "N/A">
- File found: yes
- Sections detected: 0

La constitución existe pero está vacía o no contiene secciones H2. Sugiere al usuario correr `/setup` para llenarla con el contexto del proyecto.
```

### Formato Caso Especial 3 — archivo malformado pero recuperable

Si el parser puede recuperar secciones parciales pese al malformato, usa el formato principal normalmente. No se produce un formato separado para malformato "leve".

### Formato Caso Especial 4 — error de lectura

```
### Constitution Context (vision/constitution.md)

- File found: yes, but encoding could not be detected or permissions denied.

No se pudo leer el archivo. Verifica que esté en UTF-8 y tenga permisos de lectura.
```

## Reglas de Parseo

### Frontmatter YAML

- El frontmatter empieza en la **primera línea** del archivo con `---` (exactamente 3 guiones, nada más en la línea).
- El cierre es la siguiente aparición de `---` en línea sola.
- Si no hay cierre → no hay frontmatter válido, todo el archivo se trata como `body` y `projectName = null`.
- El contenido intermedio se parsea como YAML. Si falla, se ignora silenciosamente y `projectName = null`.

### Encabezados H2

- Regex exacto: `^##\s+(.+?)\s*$`
- **Aceptados**: `## Stack`, `## Mi Sección Custom`, `## Deploy & CI/CD`, `## 1. Introducción`
- **Rechazados**: `##` (sin espacio ni contenido), `### Algo` (es H3), `##Stack` (sin espacio después de `##`), `## ` seguido solo de whitespace (contenido vacío tras trim)

### Contenido de sección

- Incluye todo entre el H2 y el siguiente H2 (o EOF).
- Preserva líneas en blanco internas.
- Trim de líneas en blanco al inicio y final del bloque.
- Preserva H3, H4, H5, H6 que estén dentro (se tratan como contenido, no como separadores).
- Preserva H1 (`#`) si aparece después de un H2: se incluye como contenido de esa sección. Un H1 que aparece **antes del primer H2** se ignora completamente.
- Preserva bloques de código (entre triples backticks) tal cual.

**Excepción conocida**: si un bloque de código contiene `## ` al inicio de una línea interna, el parser simple lo detectará como H2 y romperá la sección. Es una limitación aceptada del parser simple; documenta al usuario que evite `## ` al inicio de línea dentro de bloques de código en su `constitution.md`.

### Duplicados

- Si dos H2 tienen el mismo `title` literal, ambos se incluyen como entradas separadas en `sections` (en el orden encontrado, no se descarta ninguno).
- Se añade al header del output una línea por cada título duplicado: `- Warning: duplicate section title "<titulo>" detected (<n> occurrences).`.
- La comparación es case-sensitive: `## Stack` y `## stack` se consideran distintos títulos.

## Casos Especiales

| # | Condición                                              | Output                             |
|---|--------------------------------------------------------|------------------------------------|
| 1 | `vision/constitution.md` no existe                     | Formato Caso Especial 1            |
| 2 | Archivo existe pero 0 secciones H2 detectadas          | Formato Caso Especial 2            |
| 3 | Archivo con markdown malformado pero recuperable       | Formato principal (best-effort)    |
| 4 | Error de lectura (encoding, permisos)                  | Formato Caso Especial 4            |
