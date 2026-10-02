# Memoria compartida del equipo (Omnia)

> **Este documento se retiró.** Describía el método anterior (túnel SSH + Vaultwarden), que ya no se usa para la memoria:
> el gateway con un token por persona lo reemplazó y los repos se migran con `/memory-setup`. La versión del método anterior
> sigue en el historial de git de este archivo.

Lo vigente:

| Si quieres… | Lee |
|---|---|
| Conectarte como dev (alta, repos, tokens, portal) | [`MANUAL-DEV.md`](MANUAL-DEV.md) |
| Dar de alta personas, administrar tokens, espacios y permisos | [`MANUAL-ADMIN.md`](MANUAL-ADMIN.md) |
| El trabajo de todos los días (recall, write, handoff) | [`WORKFLOW.md`](WORKFLOW.md) |
| Qué escribir, dónde y cómo | [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md) |
| Cómo ordenar las notas largas | [`ESTRUCTURA-NOTAS.md`](ESTRUCTURA-NOTAS.md) |
| Quién ve qué (roles y espacios) | [`PERMISOS.md`](PERMISOS.md) |
| El porqué del diseño | [`ARQUITECTURA.md`](ARQUITECTURA.md) |

Resumen: un token por persona abre las dos memorias (Mem0, memorias cortas; Basic Memory, notas largas) a través del gateway
`memory.omniaos.ai` / `kb.omniaos.ai`, y un portal (`memorypanel.omniaos.ai`) administra personas, tokens, espacios y permisos.
Todo se organiza en espacios: `global`, `proy-<producto>`, `int-<cliente>` y `cli-<cliente>`.
