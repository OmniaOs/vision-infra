---
name: session-close
description: 'Checklist de cierre para CUALQUIER tipo de sesión de trabajo — tarea de spec, hotfix (con o sin PR), o soporte/diagnóstico puro en un VPS sin tocar código. Decide si hay una lección corta para memory-write, una nota larga para omnia-knowledge, y/o trabajo a medias para handoff, sin depender de que exista un commit. Invocar al terminar una sesión, la tengas o no en un repo con cambios de código.'
---

# Session Close

## Propósito

`memory/hermes` (el daemon de self-learning) solo ve dos cosas: commits
git y archivos en `telemetry/handoffs/`. Eso deja afuera una porción real
del trabajo del equipo — sesiones de soporte o diagnóstico puro en un VPS
que no tocan ningún repo con código (ver `memory/feedback_memoria_simplicidad`
y la discusión que la originó: la sesión que diagnosticó a Hermes mismo no
generó un solo evento para que Hermes la viera).

Esta skill reemplaza "¿hubo un commit?" como gatillo por "¿terminó la
sesión?" — funciona igual para una tarea de spec, un hotfix directo a
rama, o una sesión que solo corrió `script_run` contra un servidor y no
escribió ni una línea de código. Es la única skill que hace falta recordar
al cerrar, sin importar qué tipo de sesión fue.

No reemplaza a `memory-write`, `omnia-knowledge` ni a `handoff` — los
invoca. Esta skill es solo el checklist que decide CUÁL(ES) corresponde
invocar.

## Entrada

Ninguna. Se invoca sin argumentos al terminar la sesión — la skill mira el
propio historial de la conversación actual para decidir.

## Algoritmo

Ejecuta los pasos en orden. No omitas pasos. No reordenes pasos.

### Paso 1 — Evaluar si hay una lección para memoria

Aplica el mismo filtro que ya usa `memory-write` (Paso 1 de esa skill) sin
reinventarlo: ¿esta sesión resolvió algo no obvio — un gotcha, una
decisión de infra, un hallazgo de diagnóstico, una causa raíz — que otra
persona (o vos mismo en 3 meses) tendría que redescubrir si no queda
escrito? Esto aplica **igual si la sesión no tocó código**: un diagnóstico
puro contra un VPS que encontró la causa de un problema cuenta tanto como
un fix de código.

Si sí → junta el/los hecho(s) en lenguaje natural (uno por lección
independiente) y invoca la skill `memory-write` con ellos. Dejá que esa
skill decida el namespace (`project` vs `global`) — no lo decidas acá.

Si no (la sesión fue una consulta simple, o no produjo ningún hallazgo
nuevo) → no invoques `memory-write`. No fuerces una entrada solo por
cerrar el checklist.

### Paso 2 — Evaluar si el hallazgo amerita una nota larga en `omnia-knowledge`

Independiente del Paso 1 — no son excluyentes. Un mismo hallazgo puede
generar ambos (un hecho corto en Mem0 para búsqueda rápida, y una nota
completa acá para quien necesite el detalle), solo uno, o ninguno.

Criterio (fuente canónica: `vision-infra/memory/CONVENCION-DE-CONTENIDO.md`,
sección "Regla para decidir Mem0 vs. `omnia-knowledge`" — no repetirlo acá
si cambia, solo linkearlo): ¿el hallazgo tiene estructura real — línea de
tiempo, varias observaciones conectadas, causa + fix + pendientes, una
decisión de arquitectura con su razonamiento, la ficha de una
implementación de cliente? Eso se lee mejor como documento que como
oración suelta.

Si sí → escribí la nota en `omnia-knowledge/projects/<proyecto-o-cliente>/`
con el frontmatter y formato de `CONVENTIONS.md` (`Observations`,
`Relations`). Si el proyecto/cliente no tiene carpeta todavía, creála.

Si no (el hallazgo es una lección corta, ya cubierta por el Paso 1) → no
crees una nota — no dupliques el mismo hecho en las dos capas sin motivo.

Si el MCP `basic-memory` no está conectado en esta sesión (repo sin ese
bloque en `.mcp.json`, o el piloto todavía no desplegado) → Caso Especial
3, no bloquea el resto del checklist.

### Paso 3 — Evaluar si queda trabajo a medias

¿La tarea de esta sesión quedó incompleta, bloqueada, o en un estado que
otra persona/modelo/cuenta necesitaría entender para retomarla sin
volver a investigar desde cero? Esto es independiente del Paso 1 — una
sesión puede dejar una lección Y trabajo a medias, ninguna de las dos, o
solo una.

Si sí → invoca la skill `handoff` para dejarlo documentado en
`telemetry/handoffs/`.

Si no (la tarea cerró completa, o fue una consulta sin tarea de por
medio) → no invoques `handoff`.

### Paso 4 — Reportar

Nunca sale en silencio total, aunque ninguno de los tres pasos haya
aplicado — reporta la decisión tomada en los tres, con la razón, para que
quien lea la sesión después sepa que el checklist corrió y qué decidió,
no que se saltó.

## Formato de Salida

```markdown
### session-close

- Memoria (Mem0): <"guardado(s) N hecho(s) vía memory-write" | "nada que guardar — <razón corta>">
- Nota (omnia-knowledge): <"escrita en projects/<x>/..." | "no ameritaba nota larga" | "basic-memory no conectado en esta sesión">
- Handoff: <"escrito vía handoff" | "no hacía falta — <razón corta>">
```

## Casos Especiales

### Caso Especial 1 — Sesión sin ningún hallazgo ni tarea

```markdown
### session-close

- Memoria (Mem0): nada que guardar — la sesión fue una consulta sin hallazgo nuevo.
- Nota (omnia-knowledge): no ameritaba nota larga.
- Handoff: no hacía falta — no había ninguna tarea en curso.
```

### Caso Especial 2 — `memory-write` o `handoff` no disponibles en esta sesión

Si alguna de las dos skills invocadas no puede completarse (ej. el MCP de
memoria no está conectado), reporta ese Caso Especial tal como esa skill
lo define — `session-close` no lo oculta ni lo reintenta por su cuenta.

### Caso Especial 3 — `basic-memory` (omnia-knowledge) no conectado

```markdown
- Nota (omnia-knowledge): no se pudo escribir — el MCP `basic-memory` no
  está conectado en esta sesión. Si el repo debería tenerlo (piloto ya
  desplegado), revisá `.mcp.json`; si el piloto todavía no está
  desplegado en el VPS, es esperado — ver `omnia-knowledge/deploy/DEPLOY.md`.
```

## Reglas Clave

1. **Agnóstico a si hubo código o commit.** El gatillo es "terminó la
   sesión", no "hubo un push". Una sesión de puro diagnóstico en un VPS
   pasa por el mismo checklist que una de código.
2. **No reinventa el criterio de qué guardar** — delega en `memory-write`
   (namespace, redacción, verificación), en `omnia-knowledge/CONVENTIONS.md`
   (formato de nota larga) y en `handoff` (formato de continuidad). Esta
   skill solo decide CUÁL corresponde invocar.
3. **Mem0 y omnia-knowledge no son excluyentes.** Un mismo hallazgo puede
   generar un hecho corto Y una nota larga — sirven para búsquedas
   distintas (semántica rápida vs. lectura completa).
4. **Nunca fuerza una entrada** para no cerrar el checklist en blanco —
   "nada que guardar" es una salida válida y esperable la mayoría de las
   veces.
5. **No depende de ningún hook.** Se invoca a mano al cerrar — un
   mecanismo automático vía hooks de Claude Code no es viable hoy sin
   crear ruido en cada turno (`Stop` dispara por turno, no por sesión;
   `SessionEnd` no puede reengachar al modelo para que actúe).
