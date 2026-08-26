#!/usr/bin/env node
/**
 * pre-push-scan.mjs — Compuerta de calidad en push (enforcement de máquina).
 *
 * Corre el set de pruebas CRÍTICO (money-path) antes de permitir el push.
 * Solo actúa si el repo define un comando crítico; si no, es no-op (no estorba
 * a repos sin harness). Bloquea el push (exit 1) si el set falla.
 *
 * Cómo resuelve el comando (en orden):
 *   1. env CRITICAL_TEST_CMD  (cualquier stack)
 *   2. package.json script test:critical  (npm/pnpm/yarn según lockfile)
 *   3. package.json script test:money
 *   4. ninguno → no-op
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = process.cwd(); // git corre los hooks desde la raíz del repo

function pkgScripts() {
  try {
    return JSON.parse(fs.readFileSync(`${ROOT}/package.json`, 'utf8')).scripts || {};
  } catch {
    return {};
  }
}
function pm() {
  if (fs.existsSync(`${ROOT}/pnpm-lock.yaml`)) return 'pnpm';
  if (fs.existsSync(`${ROOT}/yarn.lock`)) return 'yarn';
  return 'npm run';
}

let cmd = process.env.CRITICAL_TEST_CMD;
if (!cmd) {
  const s = pkgScripts();
  if (s['test:critical']) cmd = `${pm()} test:critical`;
  else if (s['test:money']) cmd = `${pm()} test:money`;
}

if (!cmd) {
  // Sin set crítico cableado → no bloquear. Sugerencia informativa.
  console.error('guardrails pre-push: sin set crítico (define CRITICAL_TEST_CMD o script test:critical). Push permitido.');
  process.exit(0);
}

console.error(`\n🔒 guardrails: corriendo set crítico antes de push → ${cmd}`);
try {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  console.error('✓ set crítico verde — push permitido.\n');
  process.exit(0);
} catch {
  console.error('\n⛔ guardrails: el set crítico (money-path) FALLÓ — push bloqueado.');
  console.error('Arregla las pruebas, o corre `/verify` para ver el detalle.');
  console.error('Emergencia: `git push --no-verify` (queda marcado sin pruebas).\n');
  process.exit(1);
}
