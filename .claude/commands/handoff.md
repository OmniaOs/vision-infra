---
name: handoff
description: 'Escribe un handoff de la tarea actual para retomarla en otra sesión/modelo/cuenta sin perder contexto; registra los tokens y commitea todo (incl. WIP).'
---

# /handoff — Preparar cambio de modelo/cuenta sin perder contexto

Vas a preparar el switch de modelo/cuenta preservando el contexto de la tarea actual. Tarea: `$ARGUMENTS` (si está vacío, deriva un slug corto del objetivo de esta conversación).

1. Escribe (o actualiza) `telemetry/handoffs/<tarea>.md` siguiendo la estructura de `telemetry/handoffs/_TEMPLATE.md`. Llena TODO con base en esta conversación: objetivo, estado actual real (qué funciona, qué está a medias), decisiones tomadas con sus razones, archivos tocados, próximos pasos en orden, y gotchas/callejones sin salida ya explorados. Sé específico: el lector será otro modelo SIN acceso a esta conversación.
2. Incluye la rama git actual y el estado del working tree (`git status --short`).
3. Registra los tokens de esta sesión:
   ```bash
   node telemetry/scripts/log-usage.mjs --task "<tarea>"
   ```
4. Haz commit del handoff + el log de uso + el trabajo en progreso (WIP está bien): `wip(<área>): handoff <tarea>`.
5. Termina diciéndole al usuario qué archivo de handoff quedó, y que en la sesión nueva (otro modelo/cuenta) debe abrir el IDE en el repo y correr `/resume <tarea>`.

Regla de oro: el handoff se escribe ANTES de que se muera la sesión, no después.
