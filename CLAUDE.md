# CLAUDE

<!-- omnia-memoria:inicio v1 -->
## Memoria compartida de Omnia (obligatorio)

Este repo usa la memoria compartida de Omnia: lecciones cortas en Mem0 (`omnia-memory` del repo y `omnia-memory-global` de todo Omnia) y notas largas en Basic Memory (`basic-memory`).
Espacio de este repo: `proy-vision-infra` (Mem0: namespace `vision-infra`, el que ya trae `omnia-memory` en `.mcp.json`; Basic Memory: proyecto `proy-vision-infra`). Lo que aplica a todo Omnia va a `global`.

### Antes de empezar: lee
Busca hechos relacionados con la tarea antes de tocar nada: `search_memory` en `omnia-memory` y en `omnia-memory-global`, y `search_notes` en Basic Memory (proyecto `proy-vision-infra` y proyecto `global`). Revisa sobre todo incidencias, decisiones y gotchas previos del mismo tema, para no repetir errores ni contradecir lo ya decidido.

### Al avanzar y al terminar: guarda (es parte de la tarea, no un extra)
Guarda cada vez que ocurra alguno de estos:
- **Incidencia o gap**: qué pasó, causa y cómo se resolvió (o qué falta).
- **Implementación relevante**: qué se hizo y dónde vive.
- **Decisión**: qué se eligió y por qué.
- **Gotcha**: algo no obvio que costó tiempo.

Cómo:
- Lección corta (1 a 3 frases, que se entienda sola): `add_memories` en `omnia-memory` (propia del repo) u `omnia-memory-global` (sirve a todo Omnia), o el skill `/memory-write`.
- Contenido largo (guía, incidente, decisión con contexto): `write_note` en Basic Memory, con la carpeta y el encabezado de la nota «Estructura de las notas» (proyecto `global`, carpeta `guias`).
- Si la memoria rechaza el texto (muy corto, solo un título, un id suelto, un secreto), reescríbelo con la causa y vuelve a intentar. Si guardaste algo incorrecto o ya obsoleto, bórralo con `delete_memory` o corrígelo.
- Nunca guardes contraseñas, tokens ni claves, ni datos de un cliente en `global`, ni datos personales.
- Antes de cerrar la tarea, di en el resumen qué guardaste. Si no había nada que guardar, dilo también.

### Si la memoria no está conectada
Si no aparecen las herramientas `omnia-memory`, `omnia-memory-global` o `basic-memory`, o fallan con 401/403, no sigas en silencio: avisa al usuario y guíalo así:
1. Pedir su token personal a un admin (se genera en memorypanel.omniaos.ai, sección Personas/Tokens).
2. Guardarlo en la variable de usuario `OMNIA_MEMORY_TOKEN`.
3. Correr `/memory-setup` en este repo.
4. Reiniciar Claude Code por completo.

`401` = token mal copiado o revocado. `403` = ese espacio no está asignado a su cuenta (pedirlo al admin). Guía completa: nota «Manual del dev: conectarte a la memoria compartida» (proyecto `global`, carpeta `guias`) o `memory/MANUAL-DEV.md` en el repo `vision-infra`.
Mientras no haya conexión, deja lo aprendido escrito en el resumen final para guardarlo después.
<!-- omnia-memoria:fin -->
