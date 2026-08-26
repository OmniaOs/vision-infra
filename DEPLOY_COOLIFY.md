# Deploy en Coolify

> Reconstruido el 2026-08-26 — el archivo original referenciado por
> [`gateway/README.md`](gateway/README.md) y [`memory/README.md`](memory/README.md)
> nunca existió en el checkout local. Este documento se arma a partir de los
> `docker-compose.yml` de cada servicio, el historial de git, y verificación en
> vivo del nodo de producción vía OCC (`server-omniaplatform`). Dos cosas
> marcadas abajo como **[VERIFICAR]** necesitan confirmarse contra la consola
> de Coolify directamente — no se pudieron comprobar desde este checkout.

## Infraestructura

- **VPS:** OVH, alias OCC `server-omniaplatform`, IP `148.113.203.22`.
- **Orquestador:** Coolify. Cada servicio de este repo es un recurso
  independiente tipo "Docker Compose", apuntando a su subcarpeta.
- **Runtime confirmado en producción (2026-08-26):** contenedores
  `litellm-*`, `db-*` (Postgres, del gateway), `openmemory-mcp-*`,
  `mem0_store-*` (Qdrant), `hermes-*`, `metrics-hub-*`, más `coolify-proxy`
  (Traefik) y `coolify-sentinel` a nivel de plataforma.

## Orden de deploy

1. **`gateway/`** — primero. `memory/` (Hermes, openmemory-mcp) y
   potencialmente `metrics-hub/` pueden apuntar su LLM al gateway
   (`HERMES_LLM_BASE_URL=https://gateway.omniaos.ai`), así que necesita
   existir antes.
2. **`memory/`**
3. **`metrics-hub/`**

## Por servicio

### `gateway/` — LiteLLM

- Recurso Coolify: Docker Compose, build desde `gateway/`.
- Secrets a definir en Coolify (nombres — ver valores reales en `gateway/.env.example`):
  `LITELLM_MASTER_KEY`, `POSTGRES_PASSWORD`, `ZAI_API_KEY`.
- Puerto `4000`, publicado solo en `127.0.0.1` desde el fix de seguridad
  (commit `82cba23`, 2026-07-24).
- Dominio esperado: `gateway.omniaos.ai` (referenciado como default de
  `HERMES_LLM_BASE_URL` en `memory/.env.example`). **[VERIFICAR]** si ese
  dominio sigue activo vía el Traefik de Coolify — el binding a loopback
  solo afecta el puerto publicado al *host*, no el ruteo interno de Traefik
  por red de Docker, así que es posible que el dominio siga sirviendo tráfico
  aunque el puerto directo ya no sea alcanzable desde fuera. Confirmarlo en
  la consola de Coolify.

### `memory/` — Mem0/OpenMemory + Hermes

- Recurso Coolify: Docker Compose, build desde `memory/`.
- Secrets (ver `memory/.env.example`): `OPENMEMORY_API_KEY`, `OPENAI_API_KEY`,
  `LLM_BASE_URL` (opcional, para enrutar por el gateway), `HERMES_LLM_API_KEY`,
  `HERMES_LLM_MODEL` (default `glm`), `GITHUB_TOKEN` (read-only, clona los
  repos que observa Hermes), `HERMES_PROPOSALS_TOKEN` (write, solo
  `Contents`+`Pull requests` en `vision-infra` — separado del anterior por
  mínimo privilegio).
- `openmemory-mcp` en `:8765`, `openmemory-ui` en `:3000` — **ambos en
  loopback**. `openmemory-ui` además está **desactivada por defecto**
  (Compose profile `ui`): fue el vector del incidente del 20-jul-2026 (ver
  [postmortem](docs/postmortems/2026-07-20-openmemory-ui-rce.md)). Activarla
  solo detrás de Traefik BasicAuth o vía túnel, nunca expuesta directo.
- `mem0_store` (Qdrant) sin puerto publicado — solo accesible dentro de la
  red del stack. El nombre del servicio **debe** ser `mem0_store` (host
  hardcodeado por OpenMemory).
- Dominio esperado: `memory.omniaos.ai` (`OPENMEMORY_PUBLIC_API_URL` en
  `.env.example`). Mismo **[VERIFICAR]** que el gateway.

### `metrics-hub/`

- Recurso Coolify: Docker Compose, build desde `metrics-hub/`.
- Secrets: `HUB_REPOS` (CSV `owner/repo`), `GITHUB_TOKEN`.
- Puerto `4320`, loopback-only, **sin dominio configurado** — a diferencia
  de gateway/memory, no hay ninguna referencia a un dominio `*.omniaos.ai`
  en su config. Acceso hoy: túnel SSH manual
  (`ssh -L 4320:127.0.0.1:4320 <user>@148.113.203.22`). Ponerle Traefik +
  BasicAuth vía la consola de Coolify (dominio + middleware, sin tocar el
  `docker-compose.yml`) es el punto 6 de la lista de pendientes del repo.

## Política de seguridad (post-incidente 20-jul-2026)

Desde el commit `82cba23` (24-jul-2026):

- **Todos** los puertos de los tres servicios se publican solo en
  `127.0.0.1` — acceso remoto por túnel SSH, nunca por puerto abierto a
  internet.
- `openmemory-ui` desactivada por defecto (era el vector del exploit; además
  Coolify inyecta las env de toda la app a cada contenedor del stack, así
  que la UI exponía tokens que ni siquiera usaba).
- El servicio de sistema `omnia-portblock` en el VPS bloquea puertos
  publicados hacia afuera tras el arranque de Docker — confirmado activo en
  `server-omniaplatform` vía OCC.

## Verificar estado en vivo

Ver el nodo `server-omniaplatform` desde OCC (MCP `occ`, herramientas
`nodes_get` / `services_list` / `processes_list`) — health, uptime,
servicios systemd y procesos corriendo. No requiere SSH.
