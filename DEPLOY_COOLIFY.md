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
  `HERMES_LLM_BASE_URL` en `memory/.env.example`). **No tiene registro DNS
  hoy** (confirmado 2026-08-27, `NXDOMAIN`) — nunca se llegó a configurar.
  Ver la nota de `omnia-portblock` más abajo: aunque se configure el DNS,
  hasta el 2026-08-27 el 80/443 estaban bloqueados a nivel de VPS para
  *cualquier* dominio de este repo, y separado de eso hay un bug de Coolify
  sin resolver que rompe el ruteo por Host — ver `metrics-hub/` abajo.

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
  `.env.example`). Mismo estado que `gateway.omniaos.ai`: sin registro DNS
  hoy, nunca configurado.

### `metrics-hub/`

- Recurso Coolify: Docker Compose, build desde `metrics-hub/`.
- Secrets: `HUB_REPOS` (CSV `owner/repo`), `GITHUB_TOKEN`.
- Puerto `4320`, loopback-only. **Dominio `metrics.omniaos.ai` configurado
  en Coolify (2026-08-27)**, DNS resolviendo, BasicAuth vía Traefik definido
  en `metrics-hub/docker-compose.yml` (hash bcrypt versionado, contraseña
  nunca) — ver `vision/specs/services/expose-metrics-hub-domain/`. **Bloqueado
  hoy por un bug de Coolify sin resolver**: el generador de reglas de Traefik
  para este recurso produce `Host(\`\`) && PathPrefix(\`metrics.omniaos.ai\`)`
  (Host vacío) en vez de `Host(\`metrics.omniaos.ai\`)` — persiste con
  "Strip Prefixes" desactivado y con labels de override manuales en el
  compose (Coolify las pisa; ver `1_spec.md` de la spec). Sospecha sin
  confirmar: el parser de Coolify no maneja bien el prefijo `127.0.0.1:` en
  `ports:`. Acceso funcional hoy: túnel SSH manual
  (`ssh -L 4320:127.0.0.1:4320 <user>@148.113.203.22`).

## Política de seguridad (post-incidente 20-jul-2026)

Desde el commit `82cba23` (24-jul-2026):

- **Todos** los puertos de los tres servicios se publican solo en
  `127.0.0.1` — acceso remoto por túnel SSH, nunca por puerto abierto a
  internet.
- `openmemory-ui` desactivada por defecto (era el vector del exploit; además
  Coolify inyecta las env de toda la app a cada contenedor del stack, así
  que la UI exponía tokens que ni siquiera usaba).
- El servicio de sistema `omnia-portblock` en el VPS bloquea (`iptables`/
  `ip6tables` en `DOCKER-USER`) el acceso externo directo a los puertos de
  las apps: `3000`, `4000`, `4320`, `6333`, `8765`. Versionado en
  [`infra/vps/`](infra/vps/) desde el 2026-08-27 — antes solo existía en el
  VPS, sin respaldo.
  **Bug corregido el 2026-08-27**: la lista original incluía también `80` y
  `443` (los puertos de Traefik/`coolify-proxy`), lo que hacía **imposible
  exponer cualquier dominio público** desde el fix del 24-jul-2026 — no era
  un problema del proveedor (se sospechó de OVH dos veces antes de encontrar
  esto). Detalle completo en [`infra/vps/README.md`](infra/vps/README.md).

## Verificar estado en vivo

Ver el nodo `server-omniaplatform` desde OCC (MCP `occ`, herramientas
`nodes_get` / `services_list` / `processes_list`) — health, uptime,
servicios systemd y procesos corriendo. No requiere SSH.
