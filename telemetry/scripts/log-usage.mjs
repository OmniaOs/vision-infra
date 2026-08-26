#!/usr/bin/env node
/**
 * log-usage.mjs — Colector de uso de tokens por programador.
 *
 * Lee las transcripciones locales de Claude Code (~/.claude/projects/<proyecto>/*.jsonl),
 * agrega tokens por (sesión, modelo) y los vuelca en telemetry/usage/<dev>.jsonl.
 * Es idempotente: correrlo varias veces actualiza las mismas sesiones, no duplica.
 *
 * Uso:
 *   node telemetry/scripts/log-usage.mjs                         # colecta todo lo local
 *   node telemetry/scripts/log-usage.mjs --task "checkout POS"   # fuerza nombre de tarea
 *   node telemetry/scripts/log-usage.mjs --dev juan --account cuenta-2
 *
 * Registro manual (para uso fuera de Claude Code — Cursor, web, etc.):
 *   node telemetry/scripts/log-usage.mjs --manual --task "fix impresora" \
 *     --model claude-sonnet-5 --in 120000 --out 35000 [--cache-read N --cache-write N] [--notes "..."]
 *
 * La identidad del dev se guarda en telemetry/.dev.json (NO se commitea).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TELEMETRY_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(TELEMETRY_DIR, '..');
const USAGE_DIR = path.join(TELEMETRY_DIR, 'usage');
const DEVS_FILE = path.join(TELEMETRY_DIR, 'devs.json');
const DEV_CONFIG = path.join(TELEMETRY_DIR, '.dev.json');

// ---------- args ----------
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const isManual = args.includes('--manual');

// ---------- identidad del dev ----------
function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function loadDevConfig() {
  let cfg = {};
  if (fs.existsSync(DEV_CONFIG)) {
    try { cfg = JSON.parse(fs.readFileSync(DEV_CONFIG, 'utf8')); } catch {}
  }
  const dev = flag('dev') || cfg.dev || (() => {
    try {
      const name = execSync('git config user.name', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
      return name ? slugify(name) : null;
    } catch { return null; }
  })();
  if (!dev) {
    console.error('No pude determinar tu identidad. Corre: node telemetry/scripts/log-usage.mjs --dev <tu-nombre>');
    process.exit(1);
  }
  const account = flag('account') || cfg.account || 'principal';
  const next = { dev: slugify(String(dev)), account: String(account) };
  fs.writeFileSync(DEV_CONFIG, JSON.stringify(next, null, 2) + '\n');
  return next;
}

// ---------- helpers de archivo ----------
function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}
function writeJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}
function updateDevsManifest(dev) {
  let manifest = { devs: [], pricing: {} };
  try { manifest = JSON.parse(fs.readFileSync(DEVS_FILE, 'utf8')); } catch {}
  if (!manifest.devs.includes(dev)) {
    manifest.devs.push(dev);
    manifest.devs.sort();
    fs.writeFileSync(DEVS_FILE, JSON.stringify(manifest, null, 2) + '\n');
  }
}

const { dev, account } = loadDevConfig();
const devFile = path.join(USAGE_DIR, `${dev}.jsonl`);

// ---------- modo manual ----------
if (isManual) {
  const task = flag('task');
  const model = flag('model');
  const input = Number(flag('in') || 0);
  const output = Number(flag('out') || 0);
  if (!task || !model || (!input && !output)) {
    console.error('Modo manual requiere: --task, --model y --in/--out');
    process.exit(1);
  }
  const rows = readJsonl(devFile);
  rows.push({
    ts: new Date().toISOString(),
    dev, account, task, model,
    session: `manual-${Date.now()}`,
    source: 'manual',
    input, output,
    cache_read: Number(flag('cache-read') || 0),
    cache_write: Number(flag('cache-write') || 0),
    notes: typeof flag('notes') === 'string' ? flag('notes') : undefined,
  });
  rows.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
  writeJsonl(devFile, rows);
  updateDevsManifest(dev);
  console.log(`✔ Registro manual agregado a telemetry/usage/${dev}.jsonl`);
  process.exit(0);
}

// ---------- colectar transcripciones de Claude Code ----------
function sanitizeProjectPath(p) {
  return p.replace(/[^a-zA-Z0-9]/g, '-');
}
const projectsDir = process.env.CLAUDE_PROJECTS_DIR
  || path.join(os.homedir(), '.claude', 'projects', sanitizeProjectPath(REPO_ROOT));

if (!fs.existsSync(projectsDir)) {
  console.error(`No encontré transcripciones de Claude Code en:\n  ${projectsDir}`);
  console.error('¿Abriste Claude Code dentro del repo? Si usas otra herramienta, usa el modo --manual.');
  process.exit(1);
}

function firstUserText(lines) {
  for (const l of lines) {
    if (l.type !== 'user' || !l.message) continue;
    let text = '';
    const c = l.message.content;
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c)) {
      const t = c.find(b => b.type === 'text' && typeof b.text === 'string');
      text = t ? t.text : '';
    }
    text = text.trim();
    if (!text || text.startsWith('<') || text.startsWith('Caveat:')) continue;
    return text.replace(/\s+/g, ' ').slice(0, 70);
  }
  return null;
}

const forcedTask = typeof flag('task') === 'string' ? flag('task') : null;
const sessions = new Map(); // clave: session|model

for (const f of fs.readdirSync(projectsDir).filter(f => f.endsWith('.jsonl'))) {
  const lines = readJsonl(path.join(projectsDir, f));
  const taskLabel = forcedTask || firstUserText(lines) || f.replace('.jsonl', '');
  for (const l of lines) {
    if (l.type !== 'assistant' || !l.message?.usage) continue;
    const model = l.message.model;
    if (!model || model === '<synthetic>') continue;
    const sid = l.sessionId || f.replace('.jsonl', '');
    const key = `${sid}|${model}`;
    const u = l.message.usage;
    const cur = sessions.get(key) || {
      ts: l.timestamp || new Date().toISOString(),
      dev, account, task: taskLabel, model, session: sid,
      source: 'claude-code',
      input: 0, output: 0, cache_read: 0, cache_write: 0,
    };
    cur.input += u.input_tokens || 0;
    cur.output += u.output_tokens || 0;
    cur.cache_read += u.cache_read_input_tokens || 0;
    cur.cache_write += u.cache_creation_input_tokens || 0;
    if (l.timestamp && l.timestamp > (cur.last_ts || '')) cur.last_ts = l.timestamp;
    sessions.set(key, cur);
  }
}

if (sessions.size === 0) {
  console.log('No encontré uso nuevo que registrar.');
  process.exit(0);
}

// merge idempotente: reemplaza entradas claude-code de las mismas sesiones
const existing = readJsonl(devFile);
const kept = existing.filter(r => r.source !== 'claude-code' || !sessions.has(`${r.session}|${r.model}`));
const merged = [...kept, ...sessions.values()];
merged.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
writeJsonl(devFile, merged);
updateDevsManifest(dev);

let tIn = 0, tOut = 0;
for (const s of sessions.values()) { tIn += s.input + s.cache_read + s.cache_write; tOut += s.output; }
console.log(`✔ ${sessions.size} sesión(es)-modelo registradas para "${dev}" (cuenta: ${account})`);
console.log(`  Entrada (incl. cache): ${tIn.toLocaleString()} tokens · Salida: ${tOut.toLocaleString()} tokens`);
console.log(`  Archivo: telemetry/usage/${dev}.jsonl — no olvides commitearlo.`);
