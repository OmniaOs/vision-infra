---
name: memory-write
description: 'Guarda una lección operativa en la memoria compartida de Omnia (Mem0) siguiendo memory/CONVENCION-DE-CONTENIDO.md: decide el namespace (omnia-memory del proyecto vs. omnia-memory-global), redacta cada hecho como oración densa y como decisión del equipo (el formato que el extractor de Mem0 guarda de forma confiable), reintenta si add_memories devuelve resultados vacíos, y verifica con search_memory. Invocar durante o justo después de resolver algo no obvio — un incidente, un gotcha de infra, una decisión de equipo — nunca para estado efímero de una tarea en curso.'
---

# Memory Write

## Propósito

`add_memories` (Mem0) no guarda texto tal cual: corre su propia extracción
de "hechos atómicos" por LLM, descarta tags entre corchetes, y a veces
devuelve `results: []` sin error para prosa técnica bien escrita pero
redactada como explicación en vez de como decisión. Esto está confirmado
en vivo contra el store real y documentado en
`memory/CONVENCION-DE-CONTENIDO.md`. Esta skill aplica esas reglas
mecánicamente para que quien escribe memoria no tenga que redescubrirlas
cada vez.

## Entrada

- **`hechos`** (string o lista de strings): una o más lecciones en lenguaje
  natural. Si es un párrafo con varias ideas conectadas, la skill lo separa
  en hechos independientes en el Paso 4.
- **`scope`** (`"project"` | `"global"` | `"auto"`, opcional, default
  `"auto"`): fuerza el namespace o deja que la skill lo decida (Paso 2).

## Algoritmo

Ejecuta los pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Filtrar lo que no corresponde guardar

Por cada hecho de entrada, antes de seguir:

1. Si contiene un secreto, credencial, token o password → descártalo,
   agrega el Caso Especial 1 al reporte para ese hecho, no llames a
   ningún MCP con él.
2. Si es estado efímero de una tarea en curso ("hoy no arrancó X", "estuve
   viendo Y") sin nada que siga siendo útil dentro de ~3 meses → agrega el
   Caso Especial 2, no lo guardes.
3. Si es una decisión de arquitectura o el propósito de una feature que ya
   vive (o debería vivir) en `vision/specs/` de ese repo → agrega el Caso
   Especial 3, no lo dupliques acá.
4. Los hechos que pasan el filtro siguen al Paso 2.

### Paso 2 — Decidir el namespace (si `scope == "auto"`)

Aplica el test de `memory/CONVENCION-DE-CONTENIDO.md` **por hecho**, no una
sola vez para todo el batch — hechos distintos del mismo input pueden
resolver a namespaces distintos:

1. Pregunta: *¿esta lección seguiría siendo cierta si mañana la leo
   trabajando en OTRO repo de Omnia, sin ningún contexto de este
   proyecto?*
   - Sí → candidato a `global`.
   - No (necesita saber de este proyecto/cliente para tener sentido) →
     `project`.
2. Chequeo duro, sin excepción: si el hecho nombra un cliente, un dominio
   de cliente, un ID de stack/recurso de infra específico, o cualquier
   dato que identifique a un cliente puntual → el namespace es `project`
   sin importar lo que dijera el Paso 2.1. `omnia-memory-global` es "cero
   datos de cliente, siempre".
3. Si el resultado es `project`, el namespace exacto es el `omnia-memory`
   de la sesión actual (namespace del repo donde se invoca la skill) — no
   hay forma de escribir al namespace de OTRO repo desde acá. Si la
   lección pertenece a otro proyecto (ej. estás en `vision-infra` pero la
   lección es de `frutal`), no la guardes: agrega el Caso Especial 5.

### Paso 3 — Verificar disponibilidad del MCP objetivo

1. Namespace `global` → requiere la tool `mcp__omnia-memory-global__add_memories`
   conectada en esta sesión.
2. Namespace `project` → requiere `mcp__omnia-memory__add_memories`
   conectada en esta sesión.
3. Si la que corresponde no está disponible → Caso Especial 4 para ese
   hecho (probablemente falta correr `memory-setup` en este repo, falta
   `OMNIA_MEMORY_TOKEN` en esta máquina, o el servidor se reinició y hay que
   reiniciar Claude Code). No inventes datos
   ni asumas que se guardó.

### Paso 4 — Separar en hechos atómicos

1. Si un item de entrada trae claramente varias ideas independientes
   (distintas oraciones sin relación directa entre sí) → trátalas como
   hechos separados desde acá en adelante, cada uno con su propia pasada
   por los Pasos 1-3.
2. Si es una sola idea con "regla + por qué + cuándo aplica" conectada →
   mantenla junta para el Paso 5, no la partas vos mismo — dejá que el
   extractor de Mem0 decida si la fragmenta.

### Paso 5 — Redactar cada hecho antes de enviarlo

Por cada hecho que llegó hasta acá:

1. Reformúlalo como **decisión o hecho concreto del equipo**, nunca como
   explicación técnica abstracta. Patrón: "El equipo decidió que...", "El
   equipo registró que...", "El equipo acordó que...". Es una regla
   empírica, no de estilo: la misma lección redactada como explicación
   ("un túnel necesita X porque Y") devolvió `results: []` dos veces
   seguidas contra el store real; redactada como decisión se guardó a la
   primera.
2. Nombra explícitamente los términos concretos dentro de la oración
   misma — herramientas, comandos exactos, nombres de error, nombres de
   servicio. No existe tagging: lo único que la búsqueda semántica va a
   matchear después es texto dentro de la oración.
3. Si el hecho tiene varias cláusulas conectadas, comprímelas en una sola
   oración densa con `--` o `;` en vez de mandarlas como párrafo separado
   por puntos — igual puede salir partida en 2-3 filas del lado de Mem0,
   pero cada pedazo queda con más contexto propio.

### Paso 6 — Llamar `add_memories`

Por cada hecho redactado, en el namespace resuelto:

1. Llama `add_memories` con el texto del Paso 5.
2. Si `results` no está vacío → registra cada entrada devuelta (`id`,
   `memory`, `event`) como guardada. Sigue con el próximo hecho.
3. Si `results` viene vacío (`[]`):
   - No lo des por perdido. Si el texto enviado todavía no seguía el
     patrón "El equipo decidió/registró/acordó que..." al pie de la letra,
     reformúlalo así explícitamente.
   - Si ya lo seguía, comprime aún más la oración (menos subordinadas,
     más directa).
   - Reintenta **una sola vez** con el texto reformulado.
   - Si el segundo intento también devuelve `[]` → Caso Especial 6, no
     reintentes una tercera vez.

### Paso 7 — Verificar por búsqueda, no confiar ciegamente

Por cada hecho que Paso 6 marcó como guardado:

1. Llama `search_memory` (mismo namespace) con 2-3 de los términos
   concretos que metiste en el Paso 5.2.
2. Si el hecho (o un fragmento reconocible — recordá que puede haber
   quedado partido) aparece entre los primeros resultados → confirmado.
3. Si no aparece → Caso Especial 7. No lo reintentes de nuevo; puede ser
   latencia de indexado, repórtalo tal cual.
4. **No uses `list_memories` para esta verificación bajo ninguna
   circunstancia** — está confirmado que puede no mostrar entradas que un
   `add_memories` anterior devolvió como exitosas.

## Formato de Salida

```markdown
### memory-write — resultados

| # | Hecho original (resumen) | Namespace | Resultado | Verificado |
|---|---|---|---|---|
| 1 | <primeras palabras> | project (`<slug>`) | guardado | sí |
| 2 | <primeras palabras> | global | guardado (2º intento) | sí |
| 3 | <primeras palabras> | — | descartado: contiene secreto | — |

<detalle de cada Caso Especial que aplicó, uno por línea>
```

## Casos Especiales

### Caso Especial 1 — El hecho contiene un secreto

```markdown
Descartado sin enviar: el hecho #<n> parece contener una credencial,
token o password. Nunca se manda a Mem0. Si necesitás documentar el
procedimiento, redactalo sin el valor secreto.
```

### Caso Especial 2 — Estado efímero, no memoria durable

```markdown
No guardado: el hecho #<n> describe estado de una tarea en curso, no una
lección que siga siendo útil en ~3 meses. Si más adelante se confirma como
un patrón recurrente, volvé a intentarlo entonces.
```

### Caso Especial 3 — Ya pertenece a `vision/specs/`

```markdown
No guardado en Mem0: el hecho #<n> es una decisión de arquitectura o el
propósito de una feature — eso va en `vision/specs/` de este repo (vía
`/newspec` o `/modifyspec`), no en memoria operativa. Si ya está
documentado ahí, referencialo en vez de duplicarlo.
```

### Caso Especial 4 — MCP de memoria no conectado

```markdown
No pude guardar el hecho #<n>: la tool `mcp__omnia-memory<-global>__add_memories`
no está conectada en esta sesión. Corré la skill `memory-setup` en este
repo si nunca se configuró, revisá que `OMNIA_MEMORY_TOKEN` esté definido
(tu comando personal de alta, ver `memory/ARQUITECTURA.md`) y, si el servidor
se reinició hace poco, reiniciá Claude Code.
```

### Caso Especial 5 — La lección pertenece a otro proyecto

```markdown
No guardado acá: el hecho #<n> es específico de `<proyecto mencionado>`,
no de este repo. Esta sesión solo puede escribir al namespace `project` de
donde está parada. Abrí una sesión en ese otro repo (con `memory-setup` ya
corrido ahí) para guardarlo en el namespace correcto.
```

### Caso Especial 6 — No se guardó tras dos intentos

```markdown
No se guardó el hecho #<n> tras 2 intentos (`results: []` ambas veces).
Texto enviado en el último intento: "<texto>". Puede necesitar reescritura
manual más agresiva, o simplemente no es el tipo de contenido que este
extractor conserva.
```

### Caso Especial 7 — Guardado según la API pero no verificable por búsqueda

```markdown
`add_memories` devolvió éxito para el hecho #<n> (id `<id>`), pero no
apareció al buscarlo con `search_memory` justo después. Puede ser latencia
de indexado — no es necesariamente un fallo. Si te importa confirmarlo,
reintentá la búsqueda más tarde en otra sesión.
```

## Reglas Clave

1. **Nunca** manda secretos, credenciales ni tokens a ningún namespace.
2. **Nunca** manda datos de cliente a `omnia-memory-global`, sin
   excepción, incluso si el resto del hecho parece genérico.
3. **Una llamada a `add_memories` = un hecho**, lo más denso y
   autocontenido posible — nunca párrafos esperando que Mem0 los agrupe.
4. Redacta como **decisión o hecho del equipo**, no como explicación
   técnica abstracta — es la diferencia entre que se guarde o no.
5. Verifica siempre con `search_memory`. Nunca uses `list_memories` como
   fuente de verdad de lo que quedó guardado.
6. No dupliques lo que ya vive en `vision/specs/` o en un README del repo.
