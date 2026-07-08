# 🧠 Omnia Memory

Capa de memoria **compartida** del equipo + self-learning. Este repo es el
recurso de Coolify que hostea la memoria en el VPS. Deploy: ver
[`DEPLOY_COOLIFY.md`](../DEPLOY_COOLIFY.md) en la raíz.

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

## Futuro: Hermes

Si más adelante quieren un agente autónomo siempre encendido (daemon, cron, auto-skills) que acumule conocimiento del equipo, Hermes encaja en Hetzner/Coolify y puede usar Obsidian como uno de sus knowledge bases. Es un proyecto en sí mismo; evaluar cuando Fases 1–4 estén asentadas.
