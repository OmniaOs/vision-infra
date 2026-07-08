#!/usr/bin/env node
/**
 * Hermes — daemon de self-learning del equipo Omnia (v1: propone → humano aprueba).
 *
 * Ciclo: recolecta commits/handoffs nuevos → destila lecciones con un LLM
 * (vía gateway, API key de pago) → abre un PR de propuestas para aprobación.
 * NO escribe directo a la memoria compartida.
 *
 * Uso:
 *   node index.mjs                 # un ciclo y sale
 *   node index.mjs --loop          # daemon: repite cada HERMES_INTERVAL s
 *   node index.mjs --dry-run       # sin LLM ni GitHub: escribe propuestas local
 *   node index.mjs --repos ../..   # override de repos (rutas o owner/repo, CSV)
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectInputs } from './lib/inputs.mjs';
import { distill } from './lib/distill.mjs';
import { propose } from './lib/propose.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const STATE_DIR = process.env.HERMES_STATE_DIR || '/app/state';
const DRY_RUN = has('--dry-run') || process.env.HERMES_DRY_RUN === '1';

function isoDate() {
  // Sin Date.now determinista: usamos la fecha del sistema solo para nombrar.
  return new Date().toISOString().slice(0, 10);
}

function loadCursor() {
  const f = path.join(STATE_DIR, 'cursor.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; }
}
function saveCursor(c) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, 'cursor.json'), JSON.stringify(c, null, 2));
}

async function cycle() {
  const repos = (val('--repos', process.env.HERMES_REPOS) || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!repos.length) {
    console.error('Hermes: no hay repos (HERMES_REPOS o --repos).');
    return;
  }

  const cursor = loadCursor();
  const { events, newCursor } = collectInputs({
    repos,
    reposDir: path.join(STATE_DIR, 'repos'),
    token: process.env.GITHUB_TOKEN,
    cursor,
  });
  console.log(`Hermes: ${events.length} evento(s) nuevos de ${repos.length} repo(s).`);
  if (!events.length) return;

  const proposals = await distill(events, {
    dryRun: DRY_RUN,
    baseUrl: process.env.HERMES_LLM_BASE_URL,
    apiKey: process.env.HERMES_LLM_API_KEY,
    model: process.env.HERMES_LLM_MODEL || 'claude-sonnet',
  });
  console.log(`Hermes: ${proposals.length} propuesta(s) destilada(s).`);
  if (!proposals.length) return;

  const result = await propose(proposals, {
    dryRun: DRY_RUN,
    stateDir: STATE_DIR,
    token: process.env.GITHUB_TOKEN,
    remote: process.env.HERMES_PROPOSALS_REMOTE,
    dateStr: isoDate(),
  });
  console.log(
    result.mode === 'pr'
      ? `Hermes: PR de propuestas → ${result.url}`
      : `Hermes: propuestas escritas en ${result.path}`,
  );

  saveCursor(newCursor); // solo avanza el cursor si el ciclo llegó al final
}

async function main() {
  // Un error de ciclo NO debe tumbar el daemon (evita crash-loop); en --loop se
  // reintenta al siguiente intervalo. En modo one-shot sí propaga el error.
  try {
    await cycle();
  } catch (e) {
    console.error('Hermes cycle error:', e.message);
    if (!has('--loop')) throw e;
  }
  if (has('--loop')) {
    const interval = Number(process.env.HERMES_INTERVAL || 86400) * 1000;
    // Daemon simple: el intervalo lo controla Coolify/env; sin Date.now en lógica.
    setInterval(() => {
      cycle().catch((e) => console.error('Hermes cycle error:', e.message));
    }, interval);
  }
}

main().catch((e) => {
  console.error('Hermes fatal:', e.message);
  process.exit(1);
});
