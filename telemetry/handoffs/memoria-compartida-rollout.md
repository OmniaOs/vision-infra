# Handoff: memoria-compartida-rollout

> Copia este archivo como `telemetry/handoffs/<nombre-de-la-tarea>.md`.
> Se escribe cuando el contexto se está acabando, se agotó la cuota, o al pausar la tarea.
> Al retomar en otra sesión/modelo/cuenta: `/resume memoria-compartida-rollout`.

- **Fecha:** 2026-09-28 11:10
- **Dev:** Daniel (daniel@omniaos.ai)
- **Modelo y cuenta usados hasta ahora:** Claude Sonnet 5, esta sesión (Claude Code)
- **Rama git:** main
- **Estado del working tree:** cambios sin commitear en `vision-infra` — `memory/README.md` modificado, `.claude/skills/session-close/` nuevo (untracked)

## Objetivo de la tarea

Conectar los ~20 repos de Omnia a la memoria compartida (Mem0), y luego
rediseñar cómo se captura contenido para esa memoria porque el mecanismo
original (Hermes, basado en `git log`) no ve las sesiones de soporte/
diagnóstico puro que no tocan código.

## Estado actual

**Hecho y commiteado (commits `d70c4ba` en vision-infra, `cca3dfe` en
VisionFramework, de un turno anterior de esta misma sesión):**
- Los 20 repos de Omnia tienen `.mcp.json` con `omnia-memory` (namespace
  por proyecto, slug hardcodeado) + `omnia-memory-global`.
- 3 skills nuevas en `VisionFramework/skills/` (fuente canónica,
  distribuida vía `vision init`): `memory-setup`, `memory-write`,
  `memory-recall`. Mirroreadas a mano en `vision-infra/.claude/skills/`.

**Hecho en ESTA sesión, sin commitear todavía:**
- Diagnosticado por qué Hermes lleva ~30 días fallando: `hermes` (daemon
  en Coolify) intenta llegar a `litellm` vía `http://148.113.203.22:4000`
  (IP pública del VPS), pero `litellm` publica su puerto solo en
  `127.0.0.1:4000` y corre en una red Docker de Coolify distinta a la de
  `hermes` (`um9gc3p4w5z4yaayu9ai82y6` vs `i89jyqkxuxttpy5sctbtzm7g`) — el
  container name interno es `litellm` (alias de red confirmado). **No se
  aplicó ningún fix todavía**, solo se diagnosticó.
- Diseñada y creada la skill `session-close`
  (`VisionFramework/skills/session-close.md`, mirroreada en
  `vision-infra/.claude/skills/session-close/`): reemplaza "¿hubo
  commit?" por "¿terminó la sesión?" como gatillo de captura — decide si
  corresponde invocar `memory-write` y/o `handoff` (el workflow), sin
  depender de git. Hermes baja de prioridad (queda como red de respaldo
  opcional, no como mecanismo principal).
- Publicado un Artifact ("Memoria compartida",
  `https://claude.ai/artifact/3UnNPttABdrD2vBcooHfqz`) con el mapa de
  arquitectura completo + el detalle del quiebre hermes↔litellm.
- Guardada en `omnia-memory-global` la lección sobre el gotcha de redes
  Docker de Coolify (verificada por `search_memory`, ids
  `3b112faa…`/`754340b8…`/`78968d8f…`).
- Memoria personal (no Mem0) creada:
  `feedback_memoria_simplicidad.md` — el fundamento "simple de configurar
  y de usar día a día" que Daniel dio explícitamente, y que motivó
  reabrir la elección del fix de hermes/litellm y diseñar `session-close`
  sin depender de hooks.

**Auditado (Bash + `mcp__occ__*`) el estado real de las 4 piezas que
`session-close` necesita por repo, en los ~19 repos además de
`vision-infra`:**

| Pieza | Repos que la tienen |
|---|---|
| `.mcp.json` con `omnia-memory`/`omnia-memory-global` | los 20 (ya resuelto) |
| Skills `session-close`/`memory-write`/`memory-recall` en `.claude/skills/` | solo `vision-infra` |
| Workflows `handoff`/`resume` en `.claude/commands/` | `OmniaPOS`, `cfdi`, `checador`, `omnia-client-portal`, `vision-infra` (los que corrieron `vision init` completo alguna vez) |
| `telemetry/handoffs/_TEMPLATE.md` | mismos 5 de arriba |

O sea: hoy `/session-close` completo (memoria + handoff) solo funciona
sin fricción en `vision-infra`. En 14 repos faltan las últimas 3 piezas.

## Decisiones tomadas (y por qué)

- **`session-close` reemplaza a Hermes como gatillo principal** → Hermes
  solo ve `git log` + `telemetry/handoffs/`, así que una sesión de puro
  diagnóstico en un VPS (como la que encontró el bug de Hermes mismo)
  nunca genera un evento para que Hermes la vea. Hermes queda como red de
  respaldo opcional para repos con git activo, no como el mecanismo.
- **No se implementó un hook automático (`Stop`/`SessionEnd`) para
  disparar `session-close`** → `Stop` dispara en cada turno de Claude, no
  al final de la sesión (metería fricción en cada respuesta). `SessionEnd`
  dispara solo al final real pero no puede reengachar al modelo para que
  actúe (ya no hay turno del agente disponible). Se decidió que
  `session-close` se invoca a mano — es proceso/hábito, no algo
  automatizable limpiamente hoy con el sistema de hooks real.
- **El fix de hermes↔litellm quedó reabierto, no decidido** → originalmente
  se propuso "unir hermes a la red Docker de litellm" (más aislado). Bajo
  el fundamento de simplicidad, se reconsideró: un dominio Traefik +
  BasicAuth para litellm (como ya se hizo para `metrics-hub`, receta ya
  documentada y probada) puede ser más simple de configurar en la
  práctica que unir redes en la consola de Coolify, aunque exponga algo
  más de superficie. **No se decidió cuál aplicar.**
- **Propagación a los 14 repos sin las 3 piezas: dos caminos, sin decidir**
  — (A) re-correr `vision init` en cada uno (trae todo el framework de
  specs, quizás no deseado en repos que no lo usan) vs. (B) mirrorear a
  mano solo las 3 skills + el template de handoff (quirúrgico, pero hay
  que repetirlo a mano con cada skill nueva futura).

## Archivos tocados

- `vision-infra/memory/README.md` — puntero a `session-close` agregado
  (sin commitear).
- `vision-infra/.claude/skills/session-close/SKILL.md` — nuevo, mirror de
  `VisionFramework/skills/session-close.md` (sin commitear).
- `vision-infra/telemetry/handoffs/memoria-compartida-rollout.md` — este
  archivo.

## Próximos pasos (en orden)

1. Decidir con Daniel: propagar `session-close`/`memory-write`/
   `memory-recall`/template de handoff a los 14 repos vía `vision init`
   completo, o vía mirror manual quirúrgico (opción A vs B arriba).
2. Decidir el fix de hermes↔litellm: red Docker compartida vs. dominio
   Traefik+BasicAuth — aplicar el elegido (toca la consola de Coolify,
   que hoy no tiene MCP conectado — falla con CSRF token mismatch, probar
   de nuevo o hacerlo a mano).
3. Una vez elegida la propagación, ejecutarla y volver a auditar la tabla
   de 4 piezas por repo.
4. Commitear `vision-infra` (README.md + `.claude/skills/session-close/`)
   y este handoff — no se hizo todavía en esta sesión.
5. Instalar el hábito de correr `/session-close` al cerrar cualquier
   sesión — es proceso, no hay atajo de configuración.

## Gotchas / NO hacer

- No asumas que `omnia-memory`/`omnia-memory-global` están conectados sin
  chequear — se cayeron y reconectaron varias veces durante esta sesión
  (`ECONNREFUSED` con el túnel sano por debajo; problema del cliente MCP
  de la sesión, no de la infra).
- No repitas el fix de hermes→litellm apuntando a la IP pública de nuevo
  — es exactamente la causa raíz ya confirmada.
- Coolify MCP (`coolify`) falla con `419 CSRF token mismatch` de forma
  persistente en esta sesión — usar `mcp__occ__script_run` contra
  `server-omniaplatform` como alternativa de diagnóstico/lectura, no
  bloquearse esperando que Coolify MCP reconecte.
- No dupliques en Mem0 lo que ya vive en `memory/README.md`,
  `memory/RUNBOOK.md` o los propios `SKILL.md` — ya se aplicó ese filtro
  al decidir qué guardar en esta sesión (ver `memory-write`, Caso
  Especial 3).
