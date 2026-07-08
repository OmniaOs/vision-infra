#!/usr/bin/env node
/**
 * collect.mjs — Agregador del Omnia Metrics Hub.
 *
 * Junta la telemetria de tokens (telemetry/usage/*.jsonl) de varios repos +
 * la actividad de commits (git log) y produce data/aggregate.json con el
 * leaderboard compuesto del equipo (tokens, costo USD, commits y eficiencia).
 *
 * Uso:
 *   node scripts/collect.mjs [--config hub.config.json] [--since 2026-01-01]
 *
 * No tiene dependencias externas (solo Node >= 18).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HUB_ROOT = path.resolve(__dirname, '..');

function flag(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const CONFIG_PATH = path.resolve(HUB_ROOT, String(flag('config', 'hub.config.json')));
const SINCE = flag('since', null); // ISO date opcional

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`No encontre config: ${CONFIG_PATH}\nCopia hub.config.example.json a hub.config.json y ajusta las rutas de tus repos.`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const repos = config.repos || [];
const authorMap = config.authorMap || {}; // "git author name o email" -> slug oficial

function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function resolveRepoPath(p) {
  return path.isAbsolute(p) ? p : path.resolve(HUB_ROOT, p);
}
function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// pricing: merge de telemetry/devs.json de cada repo (last wins), + override en config
let pricing = {};
for (const r of repos) {
  const devsFile = path.join(resolveRepoPath(r.path), 'telemetry', 'devs.json');
  if (fs.existsSync(devsFile)) {
    try { Object.assign(pricing, JSON.parse(fs.readFileSync(devsFile, 'utf8')).pricing || {}); } catch {}
  }
}
Object.assign(pricing, config.pricing || {});
const DEFAULT_PRICE = pricing.default || { input: 5, output: 25 };

function priceFor(model) { return pricing[model] || DEFAULT_PRICE; }
function costUSD(row) {
  const p = priceFor(row.model);
  const inTok = (row.input || 0) + (row.cache_write || 0) * 1.25 + (row.cache_read || 0) * 0.1;
  return inTok / 1e6 * p.input + (row.output || 0) / 1e6 * p.output;
}
function mapAuthor(name, email) {
  if (authorMap[email]) return authorMap[email];
  if (authorMap[name]) return authorMap[name];
  return slugify(name || email || 'desconocido');
}
function afterSince(iso) { return !SINCE || (iso && iso.slice(0, 10) >= String(SINCE)); }

const devs = {}; // slug -> agregado
function dev(slug) {
  return devs[slug] || (devs[slug] = {
    dev: slug, input: 0, output: 0, cache_read: 0, cache_write: 0,
    costUSD: 0, commits: 0, tasks: new Set(),
    byModel: {}, byRepo: {}, accounts: new Set(),
  });
}

// 1) tokens
for (const r of repos) {
  const usageDir = path.join(resolveRepoPath(r.path), 'telemetry', 'usage');
  if (!fs.existsSync(usageDir)) continue;
  for (const f of fs.readdirSync(usageDir).filter(f => f.endsWith('.jsonl'))) {
    for (const row of readJsonl(path.join(usageDir, f))) {
      if (!afterSince(row.ts)) continue;
      if (row.dev === '_demo' && !config.includeDemo) continue;
      const d = dev(row.dev || f.replace('.jsonl', ''));
      d.input += row.input || 0; d.output += row.output || 0;
      d.cache_read += row.cache_read || 0; d.cache_write += row.cache_write || 0;
      const c = costUSD(row); d.costUSD += c;
      if (row.task) d.tasks.add(row.task);
      if (row.account) d.accounts.add(row.account);
      d.byModel[row.model] = (d.byModel[row.model] || 0) + (row.input || 0) + (row.output || 0);
      d.byRepo[r.name] = d.byRepo[r.name] || { tokens: 0, commits: 0, costUSD: 0 };
      d.byRepo[r.name].tokens += (row.input || 0) + (row.output || 0);
      d.byRepo[r.name].costUSD += c;
    }
  }
}

// 2) commits
for (const r of repos) {
  const repoPath = resolveRepoPath(r.path);
  if (!fs.existsSync(path.join(repoPath, '.git'))) continue;
  try {
    const sinceArg = SINCE ? `--since=${SINCE}` : '';
    const out = execSync(`git -C "${repoPath}" log ${sinceArg} --no-merges --pretty=format:%an%x09%ae%x09%aI`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    for (const line of out.split('\n').filter(Boolean)) {
      const [name, email, iso] = line.split('\t');
      if (!afterSince(iso)) continue;
      const slug = mapAuthor(name, email);
      const d = dev(slug);
      d.commits += 1;
      d.byRepo[r.name] = d.byRepo[r.name] || { tokens: 0, commits: 0, costUSD: 0 };
      d.byRepo[r.name].commits += 1;
    }
  } catch (e) {
    console.error(`Aviso: no pude leer git log de ${r.name}: ${e.message.split('\n')[0]}`);
  }
}

// 3) armar salida + metricas derivadas
const list = Object.values(devs).map(d => {
  const totalTokens = d.input + d.output + d.cache_read + d.cache_write;
  const mtok = totalTokens / 1e6;
  return {
    dev: d.dev,
    tokens: { input: d.input, output: d.output, cache_read: d.cache_read, cache_write: d.cache_write, total: totalTokens },
    costUSD: Math.round(d.costUSD * 100) / 100,
    commits: d.commits,
    tasks: d.tasks.size,
    accounts: [...d.accounts],
    // eficiencia: commits por millon de tokens (mas alto = mas entrega por token quemado)
    commitsPerMTok: mtok > 0 ? Math.round((d.commits / mtok) * 100) / 100 : 0,
    byModel: d.byModel,
    byRepo: d.byRepo,
  };
});
list.sort((a, b) => b.tokens.total - a.tokens.total);

const totals = list.reduce((t, d) => {
  t.tokens += d.tokens.total; t.costUSD += d.costUSD; t.commits += d.commits; return t;
}, { tokens: 0, costUSD: 0, commits: 0 });
totals.costUSD = Math.round(totals.costUSD * 100) / 100;

const aggregate = {
  generatedAt: new Date().toISOString(),
  since: SINCE || null,
  repos: repos.map(r => r.name),
  totals,
  devs: list,
};

const outFile = path.join(HUB_ROOT, 'data', 'aggregate.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(aggregate, null, 2));
console.log(`✔ Agregado ${list.length} dev(s) de ${repos.length} repo(s) -> data/aggregate.json`);
console.log(`  Tokens: ${totals.tokens.toLocaleString()} · Commits: ${totals.commits} · Costo est.: $${totals.costUSD}`);
