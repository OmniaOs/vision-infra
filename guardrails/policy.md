# 🛡️ Guardrails de Omnia — política del equipo

Reglas de seguridad que **todo agente** (en cualquier IDE) debe respetar. Parte
se refuerza por máquina (hooks de IDE + git hooks vía `guardrails/checks/`), y
esta política es la fuente legible + el backstop para los IDEs sin hooks.

## Reglas duras (deny — nunca hacer)

1. **Nada de secretos.** No leas, muevas ni commitees archivos bajo `_secretos/`,
   `*.env` (salvo `*.example`), `.memory.env`, `.dev.json`, llaves SSH/PEM ni
   archivos tipo `pass*.txt` / `api*.txt` / `credentials*`.
2. **Nada catastrófico/irreversible:** `rm -rf`, `DROP/TRUNCATE` de base de
   datos, `bench drop-site`, operaciones de disco (`mkfs`, `dd`), fork bombs.
3. **Permisos de ERPNext por ROL, nunca `Custom DocPerm` directo.** Usa
   `permission_manager.add/update`. (Regla de Frutal/Weritas.)

## Reglas de confirmación (ask — confirmar con un humano antes)

4. **Cambios en vivo en cualquier ERP** (crear/borrar/validar docs, permisos,
   scripts, SQL de escritura, mutaciones a `frutal.omniaos.ai`). Confirmar
   siempre antes.
5. **Git peligroso pero recuperable:** `git push --force`, `git reset --hard`,
   `git clean -f` (reescriben/descartan trabajo — confirmar la intención).
6. **Acciones hacia afuera** (push, deploy, mandar datos a servicios externos).

## Reglas de proceso (respetar en cada cambio)

7. **Doble registro** en repos de ERP: `CHANGELOG.md` (git) + DocType
   `Registro de Configuracion` en el ERP.
8. **Git commit** después de cambios; ramas, no `main` directo cuando aplique.
9. **No enrutar suscripciones personales** (Claude Max/Ultra/Kimi) por el
   gateway LiteLLM — viola ToS. El gateway es solo para API keys de pago.

## Cómo se refuerza

| Capa | Mecanismo | Alcance |
|---|---|---|
| Hooks de IDE | `guardrails/checks/precmd.mjs` vía `PreToolUse`/`beforeShellExecution` | Claude Code, Cursor, opencode |
| Git hooks | `guardrails/git-hooks/pre-commit` | **Todos** (independiente del IDE) |
| Política/reglas | este archivo, espejado como regla siempre activa | Windsurf, Kilo, Antigravity |

Todas las capas comparten la misma definición de "peligro" en
`guardrails/checks/lib.mjs`. Para ajustar qué se bloquea, edita ese archivo.
