# 🧠 Omnia Memory

Capa de memoria **compartida** del equipo + self-learning. Este repo es el
recurso de Coolify que hostea la memoria en el VPS. Deploy: ver
[`DEPLOY_COOLIFY.md`](../DEPLOY_COOLIFY.md) en la raíz del repo.

> **Decisión (jul-2026):** memoria **compartida y hosteada** con **Mem0
> self-hosted** (OpenMemory), no basic-memory local por dev. La conexión de cada
> repo la instala `vision init` (módulo `memory/` → server `omnia-memory` en
> `.mcp.json`). El bloque `basic-memory` histórico queda como referencia en
> `mcp-memory.example.json` pero **está superado**.

## Componentes

1. **Memoria canónica (fuente de verdad):** `vision/` + `telemetry/handoffs/` en
   git de cada repo. No se duplica aquí.
2. **Mem0 / OpenMemory (`docker-compose.yml`):** store compartido multi-user con
   extracción/consolidación automática. MCP en `:8765`, UI en `:3000`, Qdrant
   como vector store. Config en `.env.example`.
3. **Hermes (`hermes/`):** daemon de self-learning. Destila commits/handoffs/
   telemetría en propuestas de memoria y **abre un PR para aprobación humana**;
   nunca escribe directo a Mem0. `ingest-approved.mjs` ingiere lo aprobado.
4. **Obsidian:** capa de lectura/grafo sobre `vision/`. Ver `obsidian-setup.md`.

## Instalar basic-memory en un repo

1. Requiere `uv` (https://docs.astral.sh/uv/). `uvx` corre el server aislado.
2. Fusiona el bloque de `mcp-memory.example.json` dentro del `mcpServers` del `.mcp.json` del repo. Ejemplo para OmniaPOS (que ya tiene `dart`):

   ```json
   {
     "mcpServers": {
       "dart": { "type": "stdio", "command": "dart", "args": ["mcp-server"], "env": {} },
       "basic-memory": { "command": "uvx", "args": ["basic-memory", "mcp"] }
     }
   }
   ```
3. Reinicia el IDE/agente. Ya puede recordar y consultar conocimiento entre sesiones.

## Regla

`vision/` + handoffs siguen siendo la fuente de verdad del proyecto. basic-memory es memoria **complementaria** del agente, no la canónica. No dupliques decisiones de arquitectura fuera de `vision/`.

## Cómo dar de alta a alguien / configurar un repo

Ver [`RUNBOOK.md`](RUNBOOK.md) — pasos concretos para: alta de un dev
nuevo, un repo que nunca tuvo memoria compartida, y un repo existente que
ya tenía el bloque viejo/roto en su `.mcp.json`.

## Qué escribir, dónde, y cómo

Ver [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md) — incluye
hallazgos reales sobre cómo `add_memories` extrae y a veces descarta
contenido, probados en vivo contra `omnia-memory-global`. Leerlo antes de
escribir memoria en volumen.

## Skills (forma ejecutable de este runbook y esta convención)

Fuente canónica en `VisionFramework/skills/` (se distribuyen a cada repo
vía `vision init`). Evitan tener que aplicar el runbook/convención a mano:

- **`memory-setup`** — aplica `RUNBOOK.md` secciones 2 y 3: agrega o
  repara el bloque `omnia-memory`/`omnia-memory-global` del `.mcp.json` de
  un repo (alta nueva, retrofit de URL rota, o worktree que hereda slug).
- **`memory-write`** — aplica `CONVENCION-DE-CONTENIDO.md`: decide
  namespace, redacta cada hecho como decisión del equipo, reintenta si
  `add_memories` devuelve vacío, verifica con `search_memory`.
- **`memory-recall`** — busca en ambos namespaces con variantes de
  keywords antes de encarar una tarea; nunca usa `list_memories`.
- **`session-close`** — checklist de cierre para CUALQUIER sesión (spec,
  hotfix, o soporte/diagnóstico puro sin código): decide si corresponde
  `memory-write` y/o `handoff`, sin depender de que haya habido un commit.
  Reemplaza a Hermes como gatillo principal de captura — Hermes (basado en
  git log) nunca ve una sesión de puro soporte en un VPS.

## Piloto: omnia-knowledge (Basic Memory + Obsidian + Git)

Para contenido que Mem0 no puede sostener bien (documentos largos,
incidentes completos, arquitectura de implementación por cliente) — no
hechos atómicos de una oración. Propuesto por Emilio Dabdoub
(`Investigacion-memoria-compartida-POS-ERP.md`, 2026-09-28), piloteado
en el repo separado `omnia-knowledge`, limitado a `omniapos` + `frutal`
mientras se valida. Complementa a Mem0, no lo reemplaza — ver el
`README.md` de ese repo para el detalle de qué va en cada capa.

## Futuro: Hermes

Si más adelante quieren un agente autónomo siempre encendido (daemon, cron, auto-skills) que acumule conocimiento del equipo, Hermes encaja en Hetzner/Coolify y puede usar Obsidian como uno de sus knowledge bases. Es un proyecto en sí mismo; evaluar cuando Fases 1–4 estén asentadas.
