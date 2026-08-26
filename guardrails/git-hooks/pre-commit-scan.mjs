#!/usr/bin/env node
/**
 * pre-commit-scan.mjs — Enforcement universal (independiente del IDE).
 *
 * Revisa los archivos en stage y bloquea el commit si alguno es un secreto
 * (según guardrails/checks/lib.mjs). Es la capa que funciona pase lo que pase,
 * sin importar qué IDE/agente hizo los cambios.
 *
 * Se invoca desde el hook `pre-commit`. Sale 1 (aborta el commit) si hay
 * secretos en stage; 0 si todo limpio.
 */
import { execSync } from 'node:child_process';
import { checkSecretPath } from '../checks/lib.mjs';

let staged = [];
try {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8',
  });
  staged = out.split('\n').map((s) => s.trim()).filter(Boolean);
} catch {
  process.exit(0); // sin git o sin stage → no bloquear
}

const offenders = [];
for (const f of staged) {
  const d = checkSecretPath(f);
  if (d.block) offenders.push({ file: f, reason: d.reason });
}

if (offenders.length === 0) process.exit(0);

console.error('\n⛔ guardrails: commit bloqueado — hay secretos en stage:\n');
for (const o of offenders) console.error(`  - ${o.file}`);
console.error(
  '\nQuita estos archivos del stage (git restore --staged <archivo>) y añádelos a .gitignore.',
);
console.error('Si es un falso positivo, ajusta guardrails/checks/lib.mjs.\n');
process.exit(1);
