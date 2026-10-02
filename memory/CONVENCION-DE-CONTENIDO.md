# Convención de contenido — memoria compartida

El [onboarding self-service](INSTRUCTIVO.md) resuelve el **acceso**. Esta convención resuelve lo otro: **qué escribir, dónde
y cómo**. Sin ella, «todos escriben libre» termina en un store ruidoso e inútil para lo que importa: que alguien resuelva
un ticket o un incidente de un área ajena sin depender de la persona responsable.

> **Actualizada el 2026-10-02.** Hasta esa fecha `add_memories` pasaba por un extractor con IA (OpenMemory) que reescribía,
> descartaba o fragmentaba lo que mandabas, y las reglas de redacción de esta convención eran trucos para esquivarlo. Ese
> extractor ya no está en el camino de escritura (ver «Cómo funciona `add_memories` ahora»). Si ves memorias antiguas raras
> («Intereses en…», `OmniaPOS:<commit>`), son de esa etapa.

## Los lugares y cuál usar

Todo se organiza en **espacios** (ver [PERMISOS.md](PERMISOS.md) para saber quién ve cuál): `global`, `proy-<producto>`,
`int-<cliente>` (lo que el equipo sabe de un cliente, interno) y `cli-<cliente>` (lo que se comparte con el cliente).

> **Esta tabla es la fuente canónica.** Otros documentos deben referenciarla, no copiarla.

| Lugar | Qué guarda | Quién lo lee |
|---|---|---|
| `vision/` + `telemetry/handoffs/` (git, por repo) | Arquitectura, specs, decisiones de producto: la **fuente de verdad** del proyecto | Quien abra ese repo |
| **Memorias cortas** (Mem0): conexión `omnia-memory` = el espacio del proyecto; `omnia-memory-global` = `global` | Una lección operativa: un hecho, una o dos oraciones | Agentes y personas con acceso a ese espacio |
| **Notas largas** (Basic Memory): un proyecto por espacio | Incidentes completos, arquitectura, decisiones con su razonamiento, runbooks. Estructura fija en [ESTRUCTURA-NOTAS.md](ESTRUCTURA-NOTAS.md) | Agentes por MCP, personas desde el portal (Notas) y Obsidian |

**Global o del proyecto:** *¿esta lección seguiría siendo cierta si mañana la leo trabajando en OTRO repo de Omnia, sin
ningún contexto de este proyecto, y sin nombrar a un cliente?* Sí → `global`. No → el espacio del proyecto o del cliente.

**Memoria o `vision/`:** una decisión de arquitectura o el propósito de una feature va en `vision/specs/` (se versiona y se
referencia). La memoria es para lo que no tiene un lugar natural ahí: el detalle operativo que te ahorra repetir una investigación.

**Memoria corta o nota larga:** si hay línea de tiempo, varias observaciones conectadas, causa + arreglo + pendientes, o una
decisión con sus alternativas, es una **nota**. Un gotcha de una sola oración es una **memoria corta**. No son excluyentes:
un incidente grande genera su nota y, además, una memoria global si la lección de fondo sirve a cualquiera.

## Cómo funciona `add_memories` ahora

Desde el 2026-10-02 el gateway guarda las memorias con un servicio propio (`memory/access/memory-service.mjs`):

- **Guarda tu texto exacto.** Nadie lo reescribe, lo parte ni lo descarta. Los embeddings solo sirven para buscar.
- **Rechaza lo que no sirve, con el motivo** (el error empieza con «No se guardó: …»). Corrige y reintenta:

| Motivo | Ejemplo que se rechaza | Cómo corregirlo |
|---|---|---|
| Demasiado corta (menos de 25 caracteres) | `Evitar errores de carga` | Escribe qué pasa y qué hacer |
| Parece un título (menos de 5 palabras) | `Alineación de Datos Intercompañía` | Convierte el título en la lección |
| Solo un identificador | `OmniaPOS:aeae869` | Di qué significa ese commit o id |
| Etiqueta o lista de temas | `Intereses en Vision, DevOps, Docker` | Escribe el hecho concreto |
| Demasiado larga (más de 1500 caracteres) | un párrafo con tres temas | Una lección por llamada, o una nota |
| Parece un secreto | `password: …`, `omnia_…`, una clave privada | Describe el hecho sin el valor |

- **No duplica.** Si ya hay una lección casi idéntica en ese espacio, responde `NONE` con la existente: no la repitas.
- **Registra quién la escribió** y desde qué cliente MCP.
- **Herramientas:** `add_memories`, `search_memory` (por significado), `list_memories` (de la más reciente a la más antigua;
  ya es fiable), `delete_memory` (borra UNA de tu espacio) y `delete_all_memories` (solo administradores; nunca la uses).

## Cómo escribir una buena lección

1. **Una idea por llamada**, en una o dos oraciones completas y autocontenidas. No mandes párrafos con varios temas.
2. **Nombra lo concreto dentro de la oración:** la herramienta, el comando, el mensaje de error exacto, el servicio. No hay
   etiquetas: la búsqueda por significado solo ve el texto.
3. **Incluye el porqué o la regla**, no solo el síntoma: «X hace Y; por eso hay que Z».
4. **Que se entienda sin contexto.** Quien la lea en tres meses no sabe de qué hablabas.

| Mal | Bien |
|---|---|
| `Gotcha de Coolify con webhooks` | `Un push al repo dispara el webhook del recurso vision-infra, no el de memory-mem0: el Redeploy de memory-mem0 hay que darlo a mano.` |
| `Bench restore no imprime progreso` | `En un bench restore de varios GB no se ve progreso en consola; para saber si avanza hay que mirar el crecimiento del volumen de la base.` |
| `Evitar errores de carga` | `Antes de ejecutar un full-sync del catálogo hay que resolver el perfil POS activo, o la carga falla por falta de compañía.` |

No hace falta empezar con «El equipo decidió…»: era un truco para el extractor anterior.

## Reglas de contenido

- **Nunca secretos, credenciales ni tokens.** El servicio rechaza los patrones obvios, pero no todos: la responsabilidad es de quien escribe.
- **Nunca datos de clientes en `global`.** Lo de un cliente va en su espacio `int-` (interno) o `cli-` (compartido con él).
- **Nunca datos personales de personas** (nombres de empleados o de clientes finales con su caso). La memoria no es un sistema de registros con garantía de borrado.
- Tiene que seguir siendo útil dentro de ~3 meses: nada de ruido efímero («hoy no arrancó el build») ni estado de una tarea en curso (eso va al handoff).
- No dupliques lo que ya está en `vision/specs/` o en el README del repo: referéncialo.

## Quién escribe, y cuándo

- **Durante o justo después de resolver algo no obvio** (un incidente, un ticket de otra área, un gotcha): ese es el momento, no «luego hago un resumen».
- La skill `memory-write` lo hace por ti: decide el espacio, redacta la lección, la guarda y verifica con `search_memory`.
- **Hermes** destila automáticamente (commits + handoffs) y propone vía PR (`memory/hermes/lib/propose.mjs`). Sus propuestas
  deben pasar el mismo filtro: oraciones completas con el dato concreto, no títulos.

## Mantenimiento

- **Borrar una lección equivocada o vieja:** `delete_memory` con su id (te lo da `list_memories` o `search_memory`), o un
  administrador desde el portal (Grafo de memoria → clic en el punto → Borrar).
- **Revisar el espacio de vez en cuando** en el portal (Grafo de memoria): los temas muestran qué abunda y qué se repite.
- **Cuando una memoria crece hasta pedir estructura,** conviértela en una nota (ver [ESTRUCTURA-NOTAS.md](ESTRUCTURA-NOTAS.md)).
