# Workflow de la memoria compartida

Cuándo usar cada comando o skill, y cómo es el trabajo de todos los días.
Si es tu primera vez, empieza por [`MANUAL-DEV.md`](MANUAL-DEV.md) y vuelve aquí.

## En una línea

**Antes de empezar una tarea, busca. Cuando resuelvas algo raro, guárdalo. Al terminar la sesión, cierra.**

## Un vistazo: qué hago y cuándo

| Momento | Qué hago | Comando |
|---|---|---|
| **Una vez por persona** | Pego mi comando personal y reinicio Claude Code | el que manda el admin |
| **Una vez por repo** | Conecto el repo a las memorias | `/memory-setup` (o `vision init`) |
| **Empiezo una tarea** | Busco si alguien ya resolvió algo parecido | `/memory-recall <tema>` |
| **Resuelvo algo no obvio** | Guardo la lección corta, ya | `/memory-write` |
| **Termina la sesión** (siempre) | Dejo que decida qué guardar | `/session-close` |
| **Dejo la tarea a medias** | Escribo el traspaso | `/handoff` |
| **Retomo la tarea** (otra sesión, modelo o cuenta) | Leo el traspaso y sigo | `/resume` |
| **Algo no conecta** | Reviso token y reinicio | [`MANUAL-DEV.md`](MANUAL-DEV.md), "Si algo falla" |

## La primera vez (una sola vez)

**Tú, como persona** (10 minutos):
1. El admin te manda tu comando personal (un solo uso, no lo compartas).
2. Lo pegas en PowerShell (macOS/Linux: terminal). Debe decir `ok` dos veces y `Listo, <tu nombre>`.
3. **Cierra Claude Code por completo** y ábrelo de nuevo (todas las ventanas y el icono de la bandeja).

**Cada repo donde trabajes** (2 minutos):
1. Abre el repo en Claude Code.
2. Corre `/memory-setup`. Escribe el `.mcp.json` con las tres conexiones y **no hace commit**.
3. Reinicia Claude Code otra vez para que cargue el `.mcp.json`.

**Compruébalo** (1 minuto): pídele a Claude *"busca en la memoria compartida cómo se
redespliega memory-mem0 después de un push"*. Si te devuelve lecciones del espacio global,
estás conectado a Mem0. Para las notas: *"busca en las notas la estructura de las notas"*
debe encontrar la guía **Estructura de las notas** del proyecto `global`. También puedes
abrir el portal (`https://memorypanel.omniaos.ai`): **Notas** y **Grafo de memoria** muestran
lo que tienes asignado.

## Un día normal

```
Abro el repo ──► /memory-recall <lo que voy a hacer>
                       │
                       ▼
              Trabajo (código, soporte, diagnóstico...)
                       │
      ¿Resolví algo no obvio? ──sí──► /memory-write   (una lección corta)
                       │
                       ▼
              Termina la sesión ──► /session-close
                       │
      ¿Quedó a medias? ──sí──► /handoff   →   mañana: /resume
```

### 1. Al empezar: `/memory-recall`

Pide el tema en tus palabras: `/memory-recall Coolify dominio 502`. Busca en las
tres fuentes a la vez (Mem0 del proyecto, Mem0 global y Basic Memory), quita
repetidos y te muestra qué encontró y de dónde. Si no hay nada, sigues normal.

**Hazlo siempre** antes de investigar un problema o tocar algo que no conoces:
es lo que evita redescubrir lo que ya sabe otra persona.

### 2. Durante: `/memory-write`

Úsalo **justo cuando resuelves algo no obvio**, no "luego hago un resumen".
Cuenta como no obvio: un gotcha, la causa raíz de un error, una decisión de
infra, algo que tú (o un compañero) tendría que volver a investigar.

Escribe **una lección corta, con nombres concretos** (`Coolify`, `Traefik`, el
mensaje de error exacto) y redactada como decisión del equipo. La skill decide
si va al proyecto o al global, la reformula si hace falta y comprueba que
quedó guardada.

### 3. Al terminar: `/session-close`

**Es la única que hace falta recordar.** Sirve igual si hubo código, un hotfix o
una sesión de puro soporte sin tocar ningún repo. Sin argumentos, mira la
conversación y decide tres cosas:

1. ¿Hay una lección corta? → llama a `memory-write`.
2. ¿El hallazgo es largo y estructurado (línea de tiempo, causa + fix + pendientes)? → escribe una nota en Basic Memory.
3. ¿Queda trabajo a medias? → llama a `handoff`.

Siempre reporta qué decidió en cada punto. Si no había nada que guardar, lo dice.

### 4. Si dejas algo a medias: `/handoff` y `/resume`

`/handoff` documenta el estado para que otra persona, otro modelo u otra cuenta
pueda seguir sin volver a investigar. `/resume` lo lee y retoma donde quedó.

## ¿Dónde va lo que quiero guardar?

```
¿Es la decisión de arquitectura o el propósito de una feature?
   └─ sí → vision/specs/ (git del repo). No va a la memoria.

¿Cabe en una oración?
   ├─ sí, y seguiría siendo cierta en OTRO repo de Omnia → Mem0 global
   ├─ sí, pero necesita el contexto de este cliente/proyecto → Mem0 del proyecto
   └─ no: tiene línea de tiempo, varias partes conectadas o causa + fix
        → nota larga en Basic Memory (proyecto = el espacio, carpeta según ESTRUCTURA-NOTAS.md)
```

Un mismo hallazgo grande puede dar **una nota larga y también un hecho corto**
en Mem0 global, si la lección de fondo sirve para otros repos. La regla completa
está en [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md).

## Reglas que no se negocian

1. **Nunca secretos** en la memoria: ni contraseñas, ni tokens, ni claves. Tampoco
   pegues tu token en un chat: si se te escapa, avisa al admin para cambiarlo.
2. **Cero datos de cliente en Mem0 global.** Lo de un cliente va al proyecto de ese cliente.
3. **Que siga siendo útil en 3 meses.** Nada de "hoy no arrancó el build" ni estado de una tarea en curso.
4. **No repitas lo que ya está en `vision/specs/` o en un README.** Enlázalo.
5. **Nunca uses `delete_all_memories`** (es solo de administradores y borra todo un espacio). Si una lección es
   incorrecta, bórrala con `delete_memory`.

## Lo que conviene saber de cada memoria

- **Mem0 guarda tu texto exacto** (desde el 2026-10-02, sin IA al escribir). Una oración
  completa, un hecho, con el dato concreto. Si responde «No se guardó: …», el motivo dice
  qué corregir (muy corta, solo un título o un id, parece un secreto); `NONE` significa
  que ya existía. Detalle en `CONVENCION-DE-CONTENIDO.md`.
- **Basic Memory guarda la nota entera.** Úsala cuando importa el contexto completo.
- **Las notas de Basic Memory tardan hasta 3 minutos** en llegar a GitHub y a Obsidian.
  Los agentes las ven al instante.
- **Después de que el servidor se reinicia hay que reiniciar Claude Code:** el
  cliente no se reconecta solo. Si de golpe todo falla con "Invalid request
  parameters", es esto.

## Ejemplos reales

| Situación | Qué se guardó y dónde |
|---|---|
| Un contenedor de Basic Memory perdía los proyectos en cada redeploy | Mem0 global: una oración con la causa (volumen montado fuera de `/root/.basic-memory`) |
| `openssl` en Git Bash dejaba un `\r` invisible en las contraseñas | Mem0 global: el gotcha y el arreglo (`tr -d '\r\n'`) |
| Incidente completo de ERPNext sin estilos en Frutal | Nota larga en Basic Memory (`frutal/incidentes/`) **y** el gotcha genérico en Mem0 global |
| Cómo quedó la arquitectura de la memoria compartida | `memory/ARQUITECTURA.md` (repo), nota en Basic Memory y hechos en Mem0 |

## Qué NO hacer

- No guardes cada cosa que haces: solo lo que ahorra una investigación.
- No escribas párrafos largos en Mem0 esperando que queden juntos.
- No dejes para "mañana" el `/session-close`: es cuando más contexto tienes.
- No compartas tu comando personal ni tu token.

## Mapa de documentos

| Documento | Para quién |
|---|---|
| [`MANUAL-DEV.md`](MANUAL-DEV.md) | Cualquier persona del equipo: alta, verificación y problemas. |
| [`MANUAL-ADMIN.md`](MANUAL-ADMIN.md) | Quien administra el gateway: altas, bajas, rotaciones, despliegues. |
| [`ARQUITECTURA.md`](ARQUITECTURA.md) | Cómo está armado y por qué. |
| [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md) | Qué escribir y dónde, con los hallazgos reales sobre Mem0. |
