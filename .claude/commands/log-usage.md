---
name: log-usage
description: 'Registra el uso de tokens de las sesiones locales de este repo en telemetry/usage/<dev>.jsonl (fuente del leaderboard de quema de tokens) y lo commitea.'
---

# /log-usage — Registrar quema de tokens

Registras la quema de tokens del dev actual en el módulo de telemetría de Vision. Argumento opcional (nombre de tarea): `$ARGUMENTS`.

1. Corre el colector, agregando `--task "$ARGUMENTS"` si se pasó nombre de tarea:
   ```bash
   node telemetry/scripts/log-usage.mjs --task "$ARGUMENTS"
   ```
   (Si el repo define el script, `npm run usage:log --` / `pnpm usage:log --` son equivalentes.)
2. Muestra al usuario el resumen que imprime el script (sesiones registradas, tokens de entrada/salida).
3. Commitea el archivo actualizado:
   ```bash
   git add telemetry/usage telemetry/devs.json && git commit -m "chore(telemetry): uso de tokens"
   ```
   Si hay trabajo de código pendiente de commit, inclúyelo en su propio commit primero.

Notas:
- El script lee las transcripciones locales de Claude Code (`~/.claude/projects/<este-repo>/*.jsonl`). Si trabajaste fuera de Claude Code, usa el modo manual: `node telemetry/scripts/log-usage.mjs --manual --task "..." --model <modelo> --in <n> --out <n>`.
- Nunca edites el `.jsonl` de otro dev; cada quien escribe solo el suyo.
