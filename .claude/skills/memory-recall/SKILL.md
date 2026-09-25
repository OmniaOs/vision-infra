---
name: memory-recall
description: 'Busca lecciones relevantes en la memoria compartida de Omnia (Mem0) antes de encarar una tarea — consulta omnia-memory (namespace del proyecto) y omnia-memory-global, con varias variantes de keywords, y devuelve resultados deduplicados agrupados por namespace. Nunca usa list_memories (documentado que puede no mostrar todo lo guardado). Degrada en silencio si ningún MCP de memoria está conectado.'
---

# Memory Recall

## Propósito

Antes de investigar un problema de infra/deploy/cliente desde cero,
conviene chequear si el equipo ya lo resolvió y lo registró en Mem0. Esta
skill encapsula la forma correcta de consultar ese store — documentada en
`memory/CONVENCION-DE-CONTENIDO.md` — para que no haya que recordar cada
vez que `list_memories` no es confiable y que conviene buscar por
variantes cortas de keywords, no por la pregunta completa.

Es una skill de **solo lectura**: nunca escribe a Mem0 (para eso,
`memory-write`) ni edita `.mcp.json` (para eso, `memory-setup`).

## Entrada

- **`query`** (string): el tema sobre el que se busca contexto previo, en
  lenguaje natural.
- **`keywords`** (lista de strings, opcional): términos concretos
  adicionales para usar como variantes de búsqueda. Si no vienen, la skill
  los extrae de `query` en el Paso 2.

## Algoritmo

Ejecuta los pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Verificar qué namespaces están disponibles

1. Comprueba si `mcp__omnia-memory__search_memory` está conectada en esta
   sesión (namespace del proyecto actual).
2. Comprueba si `mcp__omnia-memory-global__search_memory` está conectada.
3. Si **ninguna** de las dos está disponible → devuelve el output del Caso
   Especial 1 y termina. Esto no es un error: la tarea que invocó la skill
   debe seguir sin memoria disponible.
4. Si solo una está disponible → continúa solo con esa, y agrega una nota
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

### Paso 3 — Ejecutar las búsquedas

1. Por cada namespace disponible (Paso 1) y cada variante (Paso 2), llama
   `search_memory` con esa variante como `query`.
2. **Nunca uses `list_memories`** como sustituto o complemento de esto —
   está confirmado que puede no reflejar todo lo que hay guardado.
3. Si alguna llamada individual falla (error de red, timeout) → sáltala,
   no aborta el resto de las variantes ni namespaces.

### Paso 4 — Consolidar resultados

1. Junta todos los resultados de todas las variantes, separados por
   namespace (`project` y `global` se consolidan por separado, no se
   mezclan entre sí).
2. Deduplica por `id` dentro de cada namespace — la misma memoria suele
   matchear varias variantes.
3. Ordena cada grupo por `score` descendente.
4. Trunca cada grupo a los 8 resultados de mayor score — más que eso es
   ruido para quien lee el output.

### Paso 5 — Formatear

1. Si ambos namespaces (o el único disponible) terminaron sin ningún
   resultado tras las 4 variantes → devuelve el output del Caso Especial
   2.
2. Si no, arma el output del Formato de Salida con el/los grupo(s) que
   tuvieron resultados. Omití por completo la sección de un namespace que
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
```

Si solo un namespace estaba disponible, agrega debajo del título una línea
como:

```markdown
_(`omnia-memory-global` no está conectada en esta sesión — solo se
consultó el namespace del proyecto.)_
```

## Casos Especiales

### Caso Especial 1 — Ningún MCP de memoria conectado

```markdown
### Memoria — <query>

Ningún namespace de memoria (`omnia-memory` / `omnia-memory-global`) está
conectado en esta sesión. Si este repo nunca se configuró, corré la skill
`memory-setup`. Si ya está configurado, revisá que `memory/tunnel.sh` esté
corriendo (`memory/RUNBOOK.md`, sección 1).

Continuando sin contexto de memoria previa.
```

### Caso Especial 2 — Sin resultados en ningún namespace disponible

```markdown
### Memoria — <query>

No hay lecciones previas registradas sobre esto en `<namespace(s)
consultados>`. Puede ser la primera vez que el equipo lo encuentra —
considerá guardar lo que descubras con `memory-write` cuando lo resuelvas.
```

## Reglas Clave

1. Solo lectura: nunca llama `add_memories`, `delete_all_memories` ni
   edita ningún archivo.
2. Nunca usa `list_memories` como fuente — solo `search_memory`.
3. Nunca bloquea ni hace fallar a quien la invoca por falta de memoria
   disponible — siempre degrada en silencio y deja que la tarea continúe.
4. Namespace `project` y `global` se muestran siempre por separado, nunca
   mezclados en una sola lista — el origen (específico de este repo vs.
   lección de equipo transversal) es información relevante para quien
   lee el resultado.
