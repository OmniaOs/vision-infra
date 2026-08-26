# 🛡️ Guardrails — instalación y enforcement

`vision init` instaló este módulo. La política está en `guardrails/policy.md`; la
definición única de "qué es peligroso" está en `guardrails/checks/lib.mjs`, y
todos los puntos de enforcement la reutilizan.

## Qué quedó configurado automáticamente

- **Claude Code**: se fusionaron hooks `PreToolUse` en `.claude/settings.json`
  (Bash y Write/Edit/Read/MultiEdit → `guardrails/checks/precmd.mjs`),
  preservando tu config existente.
- **Reglas de política**: `policy.md` disponible como contexto siempre activo en
  los IDEs que solo soportan reglas (Windsurf, Kilo, Antigravity).

## Pasos manuales (una vez por repo/máquina)

### 1. Git hooks — enforcement universal (recomendado)

Es la única capa que bloquea **sin importar el IDE**. Actívala en el repo:

```bash
git config core.hooksPath guardrails/git-hooks
```

> ⚠️ `core.hooksPath` reemplaza `.git/hooks`. Si ya usas husky u otros hooks,
> intégralos en `guardrails/git-hooks/` en lugar de sobrescribir.

En Windows, git corre los hooks con `sh` (Git Bash); no requiere `chmod`.

Hooks incluidos:
- **`pre-commit`** — bloquea commit de secretos (universal).
- **`pre-push`** — corre el **set crítico de pruebas** (money-path) y bloquea el
  push si falla. Compuerta de calidad; misma regla que `/verify`. Solo actúa si el
  repo define el comando crítico (`CRITICAL_TEST_CMD`, o script `test:critical` /
  `test:money` en `package.json`); si no hay set, es no-op. Emergencia:
  `git push --no-verify` (queda "sin pruebas"). Ver skill `test-harness`.

### 2. Cursor

Copia `guardrails/hooks/cursor.hooks.example.json` a `.cursor/hooks.json`.
`precmd.mjs` ya responde en el formato de Cursor. Verifica el esquema en
https://cursor.com/docs/hooks.

### 3. opencode

Fusiona la clave `permission` de `guardrails/hooks/opencode.permissions.example.json`
en tu `opencode.json`. Para lógica más rica, un plugin en `.opencode/plugins/`
puede llamar a `guardrails/checks/lib.mjs`.

## Probar que funciona

```bash
# debe imprimir una decisión 'deny'
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node guardrails/checks/precmd.mjs

# debe imprimir 'deny' por secreto
echo '{"tool_name":"Read","tool_input":{"file_path":"_secretos/pass.txt"}}' | node guardrails/checks/precmd.mjs

# no debe imprimir nada (allow)
echo '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | node guardrails/checks/precmd.mjs
```

## Ajustar qué se bloquea

Edita `guardrails/checks/lib.mjs` (un solo lugar). Los hooks de IDE y los git
hooks recogen el cambio automáticamente.
