# Obsidian sobre Vision (capa de lectura)

La memoria canónica del proyecto ya vive en git: `vision/` (constitution + specs) y `telemetry/handoffs/`. Obsidian solo la hace navegable (grafo, backlinks, búsqueda). No duplica nada.

## Montar el vault

1. Instala Obsidian.
2. "Open folder as vault" → apunta a la carpeta `vision/` del repo (o a la raíz del repo si quieres ver también `telemetry/handoffs/`).
3. Es solo lectura conceptual: editar aquí = editar los .md del repo (se versionan con git). No metas datos que no quieras commitear.

## Plugins recomendados

- **Graph view** (nativo): ver dependencias entre specs.
- **Dataview**: tableros a partir del frontmatter de las specs (estado, categoría).
- **Git** (community): commitear cambios de notas desde Obsidian.

## Memoria de agente (basic-memory) también como vault

`basic-memory` guarda su conocimiento como Markdown en una carpeta (por defecto `~/basic-memory`). Puedes abrir esa carpeta como un segundo vault de Obsidian y navegar lo que los agentes recuerdan, igual que las notas humanas. Para compartir en equipo, apunta esa carpeta a un directorio sincronizado (git o nube).
