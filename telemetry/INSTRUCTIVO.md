# 📊 Telemetría de tokens — Instructivo para programadores

Módulo del framework **Vision** para: (1) el **leaderboard de quema de tokens** por dev/modelo/tarea, y (2) **no perder contexto** al cambiar de modelo o de cuenta cuando se acaba la cuota.

Funciona en cualquier repo donde corras `vision init` (Node 18+). Los comandos se invocan igual con `node`, `npm run` o `pnpm`:

```bash
node telemetry/scripts/log-usage.mjs        # canónico (siempre funciona)
npm run usage:log      # si el repo tiene package.json (vision init lo agrega)
pnpm usage:log         # idem, con pnpm
```

En este instructivo usamos la forma con `node`.

## Setup (una sola vez)

1. Ten Node 18+ instalado.
2. Declara tu identidad la primera vez, **usando tu slug oficial** (así el leaderboard no te duplica):
   ```bash
   node telemetry/scripts/log-usage.mjs --dev <tu-slug> --account principal
   ```
   Esto crea `telemetry/.dev.json` (local, gitignored). Si no pasas `--dev`, se toma de tu `git config user.name` (slugificado), que puede no coincidir con tu slug oficial — mejor pásalo explícito la primera vez.

## Flujo diario

**Al terminar cada tarea (o antes de cerrar Claude Code):**

```bash
node telemetry/scripts/log-usage.mjs --task "nombre corto de la tarea"
```

- Lee las transcripciones locales de Claude Code de este repo y suma los tokens **exactos** por sesión y modelo (entrada, salida, cache read/write).
- Escribe en `telemetry/usage/<tu-nombre>.jsonl`. Es idempotente: córrelo cuando quieras, no duplica.
- **Commitea el archivo** — el leaderboard se alimenta del repo:
  ```bash
  git add telemetry/usage telemetry/devs.json
  git commit -m "chore(telemetry): uso de tokens"
  ```

Dentro de Claude Code (u otro IDE con Vision instalado) también puedes usar el comando **`/log-usage <tarea>`**, que hace todo lo anterior.

**Si trabajaste fuera de Claude Code** (Cursor, claude.ai, API): registra a mano con los números que reporte la herramienta:

```bash
node telemetry/scripts/log-usage.mjs --manual --task "fix impresora" --model claude-sonnet-5 --in 120000 --out 35000
```

## Cambiar de modelo o de cuenta sin perder contexto

Cuando se te acabe la cuota (o el contexto esté por llenarse):

1. En la sesión que muere: **`/handoff <tarea>`**. El agente escribe `telemetry/handoffs/<tarea>.md` con objetivo, estado, decisiones, próximos pasos y gotchas; registra los tokens; y commitea todo (WIP incluido).
2. Cámbiate de cuenta (logout/login en Claude Code) o de modelo (`/model`).
3. En la sesión nueva: **`/resume <tarea>`**. El agente lee el handoff, verifica el estado del repo y continúa donde quedó.
4. Si cambiaste de cuenta, dilo al agente o corre `node telemetry/scripts/log-usage.mjs --account <nombre>` para que el uso siguiente quede atribuido a la cuenta correcta.

Regla de oro: **el handoff se escribe ANTES de que se muera la sesión**, no después. Si ves que la cuota va a la mitad y la tarea es larga, ve actualizando el handoff.

## Ver el leaderboard 🔥

```bash
node telemetry/scripts/serve-dashboard.mjs
```

Abre `http://localhost:4319` con: ranking por dev (🥇🥈🥉), desglose por modelo, detalle por tarea, y costo estimado en USD (precios configurables en `telemetry/devs.json`). Filtros por periodo, dev y modelo.

Como los `.jsonl` viven en el repo, cualquiera ve el leaderboard completo del equipo con solo hacer `git pull` y levantar el dashboard.

## Estructura

```
telemetry/
├── INSTRUCTIVO.md        ← este archivo
├── devs.json             ← lista de devs + precios por modelo (USD/MTok)
├── .dev.json             ← tu identidad local (gitignored, NO commitear)
├── usage/<dev>.jsonl     ← log de uso por dev (SÍ se commitea; solo tocas el tuyo)
├── handoffs/<tarea>.md   ← contexto para retomar tareas entre sesiones/modelos/cuentas
├── dashboard/index.html  ← web app del leaderboard
└── scripts/              ← log-usage.mjs y serve-dashboard.mjs
```

## FAQ

- **¿De dónde salen los números?** De los archivos `~/.claude/projects/<este-repo>/*.jsonl` que Claude Code guarda localmente; cada respuesta del modelo trae su `usage` exacto.
- **¿Conflictos de merge?** No debería haber: cada dev escribe solo su propio `.jsonl`. `devs.json` solo cambia al agregar un dev nuevo.
- **¿El costo es real?** Es estimado con precios de API (los planes de suscripción no cobran por token), útil como métrica comparable. Precios en `telemetry/devs.json`.
- **Datos de ejemplo:** el dev `_demo` es ficticio. Bórralo cuando ya haya datos reales: elimina `telemetry/usage/_demo.jsonl` y quita `"_demo"` de `devs.json`.
