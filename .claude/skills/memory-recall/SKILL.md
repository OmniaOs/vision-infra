---
name: memory-recall
description: 'Busca lecciones relevantes en TODA la memoria compartida de Omnia antes de encarar una tarea — Mem0 (omnia-memory del proyecto + omnia-memory-global) Y Basic Memory (omnia-knowledge, el piloto de conocimiento largo), con varias variantes de keywords, deduplicado y agrupado por fuente. Nunca usa list_memories (documentado que puede no mostrar todo lo guardado). Degrada en silencio si ninguna fuente está conectada.'
---

# Memory Recall

## Propósito

Antes de investigar un problema de infra/deploy/cliente desde cero,
conviene chequear si el equipo ya lo resolvió y lo dejó registrado —
sea un hecho corto en Mem0 o una nota larga en `omnia-knowledge` (Basic
Memory). Esta skill busca en las dos fuentes con una sola invocación, para
que quien la usa no tenga que acordarse de cuál de las dos herramientas
usar ni de sus tools crudas — encapsula además la forma correcta de
consultar Mem0, documentada en `memory/CONVENCION-DE-CONTENIDO.md` (que
`list_memories` no es confiable y que conviene buscar por variantes
cortas de keywords, no por la pregunta completa).

Es una skill de **solo lectura**: nunca escribe a ningún lado (para eso,
`memory-write` y la nota larga en `omnia-knowledge`) ni edita `.mcp.json`
(para eso, `memory-setup`).

## Entrada

- **`query`** (string): el tema sobre el que se busca contexto previo, en
  lenguaje natural.
- **`keywords`** (lista de strings, opcional): términos concretos
  adicionales para usar como variantes de búsqueda. Si no vienen, la skill
  los extrae de `query` en el Paso 2.

## Algoritmo

Ejecuta los pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Verificar qué fuentes están disponibles

1. Comprueba si `mcp__omnia-memory__search_memory` está conectada en esta
   sesión (namespace del proyecto actual).
2. Comprueba si `mcp__omnia-memory-global__search_memory` está conectada.
3. Comprueba si `mcp__basic-memory__search_notes` está conectada (piloto
   `omnia-knowledge`).
4. Si **ninguna** de las tres está disponible → devuelve el output del
   Caso Especial 1 y termina. Esto no es un error: la tarea que invocó la
   skill debe seguir sin memoria disponible.
5. Si falta alguna → continúa con las que sí están, y agrega una nota
   breve en el output final mencionando cuál falta (probablemente ese repo
   no corrió `memory-setup` todavía, o el túnel no está levantado).

### Paso 2 — Generar variantes de búsqueda

1. Primera variante: `query` tal cual, sin modificar.
2. Si no vinieron `keywords` explícitos: extrae 2-3 términos concretos de
   `query` — nombres propios, nombres de herramientas, nombres exactos de
   error, comandos — y úsalos como variantes adicionales, cada uno por su
   cuenta (no combinados entre sí). La búsqueda semántica de Mem0 rinde
   mejor con términos concretos cortos que con preguntas completas largas.
3. Si vinieron `keywords` explícitos, úsalos tal cual como variantes en
   vez de extraer los tuyos.
4. Tope: no generes más de 4 variantes en total (1 query completa + hasta
   3 keywords) — más que eso es ruido de llamadas sin ganancia real de
   recall.

### Paso 3 — Ejecutar las búsquedas en Mem0

1. Por cada namespace de Mem0 disponible (`project`/`global`, Paso 1) y
   cada variante (Paso 2), llama `search_memory` con esa variante como
   `query`.
2. **Nunca uses `list_memories`** como sustituto o complemento de esto —
   está confirmado que puede no reflejar todo lo que hay guardado.
3. Si alguna llamada individual falla (error de red, timeout) → sáltala,
   no aborta el resto de las variantes ni namespaces.

### Paso 3b — Ejecutar las búsquedas en Basic Memory (`omnia-knowledge`)

Si `mcp__basic-memory__search_notes` está disponible (Paso 1):

1. Por cada variante (Paso 2), llama `search_notes` con esa variante como
   query. Si la tool acepta filtrar por proyecto y sabés a cuál pertenece
   la tarea actual (ej. estás en el repo `OmniaPOS` → proyecto
   `omniapos`), pasalo; si no, buscá sin filtro de proyecto primero — no
   está confirmado contra el server real cuál es más preciso, ajustar si
   la primera ejecución en producción lo aclara.
2. Cada resultado de nota trae `title`/`permalink` — no un `score`
   numérico igual al de Mem0 necesariamente; ordená por lo que la tool
   devuelva como relevancia, o por orden de aparición si no trae ranking.
3. Si falla (error de red, timeout, o la tool no existe con ese nombre
   exacto) → sáltalo, no aborta el resto de la skill.

### Paso 4 — Consolidar resultados

1. Junta los resultados de Mem0 por namespace (`project` y `global` NO se
   mezclan entre sí) y los de Basic Memory en un tercer grupo aparte
   (`conocimiento largo`) — nunca mezcles hechos cortos de Mem0 con notas
   largas de Basic Memory en la misma lista, son formatos distintos.
2. Deduplica por `id`/`permalink` dentro de cada grupo — la misma entrada
   suele matchear varias variantes.
3. Ordena cada grupo por relevancia descendente (score en Mem0; lo que
   devuelva `search_notes` en Basic Memory).
4. Trunca cada grupo a los 8 resultados de mayor relevancia — más que eso
   es ruido para quien lee el output.

### Paso 5 — Formatear

1. Si las tres fuentes (o las que estaban disponibles) terminaron sin
   ningún resultado tras todas las variantes → devuelve el output del
   Caso Especial 2.
2. Si no, arma el output del Formato de Salida con el/los grupo(s) que
   tuvieron resultados. Omití por completo la sección de una fuente que
   no tuvo resultados o que no estaba disponible — no muestres una
   sección vacía.

## Formato de Salida

```markdown
### Memoria — <query>

**Proyecto (`<slug del namespace omnia-memory>`):**
- <memory 1>
- <memory 2>
...

**Global (equipo):**
- <memory 1>
- <memory 2>
...

**Conocimiento largo (omnia-knowledge):**
- [<título de la nota>](<permalink>) — <primera línea o resumen breve>
...
```

Si alguna fuente no estaba disponible, agrega debajo del título una línea
como:

```markdown
_(`basic-memory` no está conectada en esta sesión — no se consultó
`omnia-knowledge`.)_
```

## Casos Especiales

### Caso Especial 1 — Ninguna fuente de memoria conectada

```markdown
### Memoria — <query>

Ninguna fuente de memoria (`omnia-memory` / `omnia-memory-global` /
`basic-memory`) está conectada en esta sesión. Si este repo nunca se
configuró, corré la skill `memory-setup`. Si ya está configurado, revisá
que `memory/tunnel.sh` esté corriendo (`memory/RUNBOOK.md`, sección 1).

Continuando sin contexto de memoria previa.
```

### Caso Especial 2 — Sin resultados en ninguna fuente disponible

```markdown
### Memoria — <query>

No hay nada previo registrado sobre esto en `<fuente(s) consultadas>`.
Puede ser la primera vez que el equipo lo encuentra — considerá guardar lo
que descubras con `memory-write` (hecho corto) y/o una nota en
`omnia-knowledge` (si amerita detalle largo) cuando lo resuelvas.
```

## Reglas Clave

1. Solo lectura: nunca llama `add_memories`, `delete_all_memories`,
   `write_note`/`edit_note` de Basic Memory, ni edita ningún archivo.
2. Nunca usa `list_memories` como fuente de Mem0 — solo `search_memory`.
3. Nunca bloquea ni hace fallar a quien la invoca por falta de memoria
   disponible — siempre degrada en silencio y deja que la tarea continúe,
   fuente por fuente.
4. Los tres grupos (`project`, `global`, `omnia-knowledge`) se muestran
   siempre por separado, nunca mezclados en una sola lista — el origen
   (específico de este repo, lección de equipo transversal, o nota larga)
   es información relevante para quien lee el resultado.
