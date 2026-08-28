# Backlog: vision-infra

## Metadata

```yaml
created: 2026-08-26
updated: 2026-08-26
```

---

## Sobre este backlog

Este backlog organiza las features del proyecto por **sprints**. Un sprint agrupa un conjunto de features relacionadas que se implementan juntas. El orden de los sprints refleja la secuencia de construcción recomendada del proyecto.

### Reglas del formato

- Cada sprint es una sección H2 con la forma: `## Sprint N — <nombre descriptivo>`.
- Cada feature es un ítem con checkbox: `- [ ] **feature-name** — ` `` `vision/specs/<categoria>/feature-name/` ``.
- Al completarse una feature: `- [x] **feature-name** — ` `` `vision/specs/<categoria>/feature-name/` `` ` — _YYYY-MM-DD_`.
- Las features completadas **permanecen en su sprint original** (preservan el histórico del sprint); nunca se mueven de lugar.
- Si el proyecto tiene frontend, Sprint 1 prioriza frontend/diseño antes que backend.
- Si el proyecto no tiene frontend, el orden se adapta al tipo (por ejemplo: en un CLI, los comandos antes que el motor interno).
- El número de sprints y de features por sprint es **variable**; depende del tamaño y la complejidad del proyecto.

### Ciclo de vida

- `/setup` llena los sprints iniciales y sus features a partir de la exploración del proyecto y las respuestas del usuario.
- `/newspec <nombre>` añade una nueva feature al sprint correspondiente.
- `/onspecomplete <nombre>` marca la feature como `[x]` y agrega la fecha de completado.

---

## Sprint 1 — Cierre de gaps operativos post-incidente

- [x] **expose-metrics-hub-domain** — `vision/specs/services/expose-metrics-hub-domain/` — _2026-08-28_
- [ ] **verify-plane-sync-end-to-end** — `vision/specs/core/verify-plane-sync-end-to-end/`
- [ ] **port-exposure-alerts** — `vision/specs/services/port-exposure-alerts/`
- [ ] **confirm-incident-scope-with-emilio** — `vision/specs/docs/confirm-incident-scope-with-emilio/`