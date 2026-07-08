# 🏆 Omnia Metrics Hub

Leaderboard **cross-repo** del equipo Omnia. Agrega la telemetría de tokens que produce el módulo `telemetry/` de Vision (en cada repo) y la cruza con la actividad de **commits**, para un ranking compuesto que premia entrega real y no solo quema de tokens.

## Métricas

- 🔥 **Tokens** por dev (entrada/salida/cache), sumados de todos los repos.
- 🚀 **Commits** por dev (de `git log`, sin merges).
- 💲 **Costo USD** estimado (precios de `telemetry/devs.json` de cada repo).
- ⚡ **Eficiencia** = commits por millón de tokens (más alto = más entrega por token quemado).

## Setup

1. Node 18+.
2. Copia la config y ajústala:
   ```bash
   cp hub.config.example.json hub.config.json
   ```
   - `repos`: nombre + ruta a cada repo que use el módulo de telemetría de Vision.
   - `authorMap`: mapea el `git author` (nombre o email) al **slug oficial** del dev (para que el commit y el token del mismo dev se junten).
   - `includeDemo`: `true` para incluir el dev `_demo` de ejemplo.
3. Corre:
   ```bash
   npm run collect      # genera data/aggregate.json
   npm run dashboard    # sirve http://localhost:4320
   # o ambos:
   npm run hub
   ```

## Opciones

```bash
node scripts/collect.mjs --since 2026-06-01      # solo desde una fecha
node scripts/collect.mjs --config otro.json      # otra config
```

## Automatización sugerida

Corre `collect` en un cron / GitHub Action y publica `data/aggregate.json` + el dashboard estático (es HTML sin dependencias) en tu Coolify/Hetzner para un leaderboard siempre fresco. También puedes disparar `collect` desde un webhook de GitHub `push`.

## Cómo encaja

```
repos con Vision  ──(telemetry/usage/*.jsonl + git log)──▶  collect.mjs  ──▶  data/aggregate.json  ──▶  dashboard :4320
```

La telemetría por repo la instala `vision init` (módulo `telemetry/`). Este hub solo agrega y rankea.
