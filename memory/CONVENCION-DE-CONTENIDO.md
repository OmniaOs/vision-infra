# Convención de contenido — memoria compartida

El [onboarding self-service](INSTRUCTIVO.md) resuelve el **acceso** a
`omnia-memory` / `omnia-memory-global`. Esta convención resuelve lo otro que
faltaba: **qué escribir, dónde, y cómo** — sin esto, "todos escriben libre"
en volumen termina en un store ruidoso e inútil para lo que de verdad importa:
que alguien resuelva un ticket o incidente de un área ajena sin depender de
la persona responsable.

> **Antes de seguir leyendo:** esta convención se reescribió después de
> probarla en vivo contra el store real (sembrando las primeras entradas el
> 2026-09-23). El diseño original asumía que Mem0 guarda texto tal cual, con
> tags. Es falso — ver "Cómo funciona realmente" abajo antes de escribir.

## Los tres lugares, y cuál usar

| Lugar | Qué guarda | Quién lo lee |
|---|---|---|
| `vision/` + `telemetry/handoffs/` (git, por repo) | Arquitectura, specs, decisiones de producto — la **fuente de verdad** del proyecto | Cualquiera que abra ese repo |
| `omnia-memory` (Mem0, namespace por proyecto) | Lecciones operativas de ESE proyecto que no son arquitectura pero sí utiles para una sesión futura ahí (gotchas del cliente, del stack, de esa base de código) | Agentes trabajando en ese repo — aislado, nunca cruza a otro cliente |
| `omnia-memory-global` (Mem0, namespace compartido) | Lecciones de **ingeniería reutilizables entre repos** — herramientas, infra, patrones. **Cero datos de cliente, siempre** | Agentes en cualquier repo de Omnia |

**Regla para decidir global vs. proyecto:** *¿esta lección seguiría siendo
cierta si mañana la leo trabajando en OTRO repo de Omnia, sin ningún contexto
de este proyecto?* Si sí → `omnia-memory-global`. Si necesita saber de este
proyecto/cliente para tener sentido → `omnia-memory`.

**Regla para decidir memoria vs. `vision/`:** si es una decisión de
arquitectura o el propósito de una feature, va en `vision/specs/` — eso ya se
versiona, se referencia por `/newspec` y `/modifyspec`, y no necesita
duplicarse acá. La memoria es para lo que **no** tiene un lugar natural en
`vision/`: el detalle operativo que te ahorra repetir una investigación.

## Cómo funciona realmente `add_memories` (importante, no es intuitivo)

Probado en vivo contra `omnia-memory-global` el 2026-09-23:

1. **No guarda el texto tal cual.** Corre su propia extracción de "hechos
   atómicos" vía LLM sobre lo que le mandes — como si fuera una conversación
   casual de la que hay que sacar datos sueltos, no un archivo de notas. Un
   párrafo de 3-4 oraciones conectadas ("la regla, por qué, cuándo aplica")
   sale hecho pedazos: cada oración termina como una fila independiente, sin
   ningún vínculo explícito entre ellas.
2. **Las tags entre corchetes se descartan.** Poner `[vision-infra][coolify]`
   al principio del texto no deja rastro en lo que queda guardado — ni una
   palabra. No hay tagging manual viable hoy; la única forma de "filtrar" es
   `search_memory` (búsqueda semántica) o revisar `list_memories` a mano.
3. **A veces no guarda nada, sin error.** Un texto técnico denso y bien
   escrito puede devolver `results: []` — ninguna fila nueva, ningún error.
   Pasó dos veces con la misma lección (SSH `StrictHostKeyChecking`)
   redactada como explicación técnica ("un túnel necesita X porque Y").
   Reescrita como decisión del equipo ("el equipo decidió agregar X a los
   túneles...") sí se guardó a la primera. **Redactar como decisión o hecho
   del equipo, no como explicación técnica abstracta, es más confiable.**
4. **`list_memories` no siempre muestra todo lo que hay.** Confirmado:
   entradas que un `add_memories` anterior devolvió como `ADD`/`UPDATE`
   exitoso no aparecieron después en `list_memories`. Esto es un límite de
   esta instancia (posible paginación o inconsistencia eventual), no algo que
   una convención de contenido pueda arreglar — si necesitás confirmar que
   algo específico quedó guardado, usá `search_memory` con esas palabras
   antes de asumir que `list_memories` te muestra el panorama completo.

**Qué significa esto para cómo escribir:**

- Una llamada a `add_memories` = **una oración, un hecho**, lo más denso y
  autocontenido posible. No mandes párrafos esperando que queden juntos.
- Nombrá explícitamente los términos concretos (`Coolify`, `Traefik`,
  `bash`, `PowerShell`, el nombre del error exacto) **dentro** de la oración
  — es lo que la búsqueda semántica va a matchear después, no hay tags.
- Si una lección tiene "regla + por qué + fix", probá primero comprimirla en
  una sola oración conectada con `--` o `;`. Puede que igual salga partida en
  2-3 filas, pero cada pedazo va a tener más contexto propio que si mandás
  4 oraciones sueltas de entrada.
- Si algo no se guarda (`results: []`), no lo dejes así — reformulalo como un
  hecho/decisión concreta del equipo antes de darlo por perdido.

## Reglas de contenido (heredadas del prompt de Hermes)

Mismas reglas que ya impone `memory/hermes/lib/distill.mjs`, explícitas
también para cuando un humano escribe directo:

- Nunca secretos, credenciales ni tokens.
- Nunca datos de cliente en `omnia-memory-global`.
- Tiene que seguir siendo útil dentro de ~3 meses — nada de ruido efímero
  ("hoy no arrancó el build", "estuve viendo X") ni estado de una tarea en
  curso.
- No dupliques algo que ya está documentado en `vision/specs/` o en un
  README del repo — referencialo, no lo repitas.

## Quién escribe, y cuándo

- **Durante o justo después de resolver algo no obvio** (un incidente, un
  ticket de otra área, un gotcha de infra) — ese es el momento, no "después
  hago un resumen".
- **Hermes** sigue destilando de forma automática (commits + handoffs) y
  proponiendo — hoy vía PR (`memory/hermes/lib/propose.mjs`); ver el item de
  Plane *"Memoria de equipo: pasar de flujo por PR a escritura directa por
  commits"* para cuándo eso cambia. El prompt de `distill.mjs` ya pide
  1-4 frases por propuesta — vale la pena revisarlo a la luz de este
  hallazgo (frases cortas y densas, no párrafos) antes de que empiece a
  escribir directo.

## Semilla real (2026-09-23)

Primeras lecciones reales cargadas a `omnia-memory-global`, resultado de la
sesión que armó el onboarding self-service — gotchas de Coolify/Traefik,
interoperabilidad Windows/bash, y Vaultwarden. Quedaron fragmentadas en
oraciones sueltas por el comportamiento descrito arriba; buscables por
`search_memory` con las palabras clave de cada tema (`Coolify`, `Traefik`,
`bash`, `Vaultwarden`, `SSH`).
