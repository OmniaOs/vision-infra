# 🔌 Omnia LLM Gateway (LiteLLM)

Gateway para **cargas programáticas** (CI, agentes batch, servicios) con **API keys de pago**, con tracking de tokens/costo por *virtual key* y presupuestos por dev/servicio.

> ⚠️ **Regla de ToS (importante).** No enrutes por aquí tus suscripciones personales (Claude Max, Google Ultra, Kimi). Los ToS de Anthropic restringen el token de Max a Claude Code/claude.ai; usarlo en un proxy para terceros es violación. El trabajo interactivo sigue por Claude Code con la suscripción de cada dev + rotación (handoffs). Este gateway es solo para tráfico con API keys facturadas.

## Deploy (Coolify / Hetzner)

1. `cp .env.example .env` y rellena `LITELLM_MASTER_KEY`, `POSTGRES_PASSWORD` y las API keys de pago.
2. `docker compose up -d`
3. UI de uso: `http://<host>:4000/ui` · endpoint OpenAI-compatible: `http://<host>:4000`.
4. En Coolify: nuevo recurso "Docker Compose", pega este repo, define las env vars como secrets.

## Virtual keys por dev (medición + presupuestos)

```bash
# crear key para un dev con presupuesto mensual y modelos permitidos
curl -X POST http://<host>:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key_alias":"gibran","max_budget":50,"budget_duration":"30d","models":["claude-sonnet","gemini-pro","kimi-k2"]}'
```

Cada dev/servicio usa su virtual key; LiteLLM registra tokens y costo por key en Postgres. Repórtalo con `/global/spend/report` o la UI.

## Uso desde un cliente

```bash
curl http://<host>:4000/v1/chat/completions \
  -H "Authorization: Bearer <virtual-key-del-dev>" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet","messages":[{"role":"user","content":"hola"}]}'
```

## Conexión con el Metrics Hub

El gasto por virtual key (API) complementa la telemetría de suscripción (interactiva). Exporta el spend de LiteLLM (`/global/spend/report`) y súmalo en el Omnia Metrics Hub para tener ambos mundos en un solo leaderboard.

## Modelos

Ajusta `litellm-config.yaml` con los model ids exactos de tu cuenta (el de Kimi/Moonshot en particular). `drop_params: true` evita errores por params no soportados entre providers.
