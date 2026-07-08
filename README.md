# 🏗️ Vision Infra — infraestructura compartida

Repo de **infraestructura** (no de producto). Contiene los servicios de servidor
que todos los proyectos de Omnia (OmniaPOS, Frutal, Weritas, …) consumen. Cada
subcarpeta es un recurso desplegable en **Coolify** sobre un VPS dedicado.

> Los repos de **trabajo** (`omniapos`, `frutal`, `weritas`) son **consumidores**
> de esta plataforma; heredan telemetría/memoria/guardrails con `vision init`
> (ver repo `VisionFramework`). Este repo es la **plomería** compartida.

## Servicios

| Carpeta | Servicio | Puerto | Qué hace |
|---|---|---|---|
| [`gateway/`](gateway/) | LiteLLM | 4000 | Gateway de LLMs para cargas programáticas (API keys de **pago**; nunca suscripciones — ToS). |
| [`memory/`](memory/) | Mem0/OpenMemory + Hermes | 8765 / 3000 | Memoria compartida del equipo (multi-user, self-learning) + daemon Hermes. |
| [`metrics-hub/`](metrics-hub/) | Metrics Hub | 4320 | Leaderboard cross-repo (tokens + commits + costo + eficiencia). |

## Deploy

Guía completa en [`../DEPLOY_COOLIFY.md`](../DEPLOY_COOLIFY.md): orden, puertos,
subdominios, secrets y comunicación entre servicios. Modelo elegido:
**Coolify vía su API** sobre un VPS nuevo (Hetzner/OVH).

## Memoria — esquema de namespaces

- **Por proyecto** (`frutal`, `weritas`, `omniapos`): aislado por cliente,
  **nunca se cruzan**.
- **`omnia-global`**: lecciones de ingeniería reutilizables (sin datos de cliente).

Cada repo de trabajo se conecta a su namespace de proyecto + al global (dos
servidores MCP que instala `vision init`).
