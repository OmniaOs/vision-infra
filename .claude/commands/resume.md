---
name: resume
description: 'Retoma una tarea pausada desde su handoff (tras cambiar de modelo/cuenta): lee el contexto, verifica el estado del repo y continúa donde quedó.'
---

# /resume — Retomar una tarea desde su handoff

Vas a retomar una tarea pausada. Tarea: `$ARGUMENTS`.

1. Lee `telemetry/handoffs/$ARGUMENTS.md`. Si no existe, lista los archivos de `telemetry/handoffs/` y pregunta al usuario cuál corresponde.
2. Verifica el estado real contra el handoff: `git log --oneline -5`, `git status --short`, y revisa por encima los archivos listados como tocados. Si algo no cuadra con lo descrito, repórtalo antes de continuar.
3. Respeta las decisiones ya tomadas (sección "Decisiones") — no las re-litigues salvo que estén rotas.
4. Continúa con los "Próximos pasos" en orden.
5. Si el dev cambió de cuenta para esta sesión, actualiza la cuenta activa:
   ```bash
   node telemetry/scripts/log-usage.mjs --account <nombre>
   ```
   (pregunta si no lo sabes).
6. Al terminar la tarea: corre `node telemetry/scripts/log-usage.mjs --task "$ARGUMENTS"`, marca el handoff como `## ✅ COMPLETADA` (o bórralo), y commitea todo.
