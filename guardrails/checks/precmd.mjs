#!/usr/bin/env node
/**
 * precmd.mjs — Punto de entrada de guardrails para hooks de IDE.
 *
 * Lee el evento del hook en stdin (JSON) y decide allow/ask/deny usando
 * guardrails/checks/lib.mjs. Emite una respuesta que entienden TANTO Claude
 * Code como Cursor (ambos comparten el modelo de eventos, con claves distintas):
 *   - Claude Code: { hookSpecificOutput: { permissionDecision, permissionDecisionReason } }
 *   - Cursor:      { permission, agentMessage, userMessage }
 *
 * Convención: en 'allow' NO emite nada y sale 0 (deja seguir el flujo normal de
 * permisos del IDE). Solo emite JSON para 'deny' o 'ask'. Sale 0 siempre; los
 * IDEs actúan por la respuesta JSON, no por el exit code.
 */
import { evaluateToolEvent } from './lib.mjs';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    // Salvaguarda: si no llega 'end' pronto, no colgar el loop del agente.
    setTimeout(() => resolve(data), 2000);
  });
}

function normalize(evt) {
  // Claude Code: tool_name + tool_input. Cursor: campos al nivel raíz.
  if (evt.tool_name || evt.tool_input) {
    return { toolName: evt.tool_name || '', input: evt.tool_input || {} };
  }
  // Cursor beforeShellExecution / beforeReadFile / etc.
  const input = {
    command: evt.command,
    file_path: evt.file_path || evt.path,
  };
  const toolName = evt.command ? 'Bash' : 'File';
  return { toolName, input };
}

async function main() {
  let evt = {};
  try {
    const raw = await readStdin();
    evt = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    // Evento ilegible → no interferir.
    process.exit(0);
  }

  const { toolName, input } = normalize(evt);
  const decision = evaluateToolEvent(toolName, input);

  if (decision.level === 'allow') {
    process.exit(0); // no interferir
  }

  const permission = decision.level === 'deny' ? 'deny' : 'ask';
  const out = {
    // Cursor
    permission,
    agentMessage: decision.reason,
    userMessage: decision.reason,
    continue: true,
    // Claude Code
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: permission,
      permissionDecisionReason: decision.reason,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

main();
