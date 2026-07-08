/**
 * inputs.mjs — Reúne "eventos" nuevos de los repos observados desde el último
 * cursor: commits (no-merge) y handoffs de telemetría. Sin dependencias.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function sh(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Resuelve un entry de HERMES_REPOS a una ruta local usable.
 * - Si es una ruta existente → se usa tal cual (útil para --dry-run local).
 * - Si es "owner/repo" → se clona/actualiza bajo reposDir usando GITHUB_TOKEN.
 */
export function resolveRepo(entry, reposDir, token) {
  if (fs.existsSync(entry) && fs.existsSync(path.join(entry, '.git'))) {
    return { name: path.basename(entry), path: entry };
  }
  const name = entry.split('/').pop();
  const dest = path.join(reposDir, name);
  const auth = token ? `https://x-access-token:${token}@github.com/${entry}.git` : `https://github.com/${entry}.git`;
  fs.mkdirSync(reposDir, { recursive: true });
  if (fs.existsSync(path.join(dest, '.git'))) {
    try { sh(`git remote set-url origin "${auth}" && git fetch --quiet --all`, dest); } catch {}
  } else {
    sh(`git clone --quiet "${auth}" "${dest}"`);
  }
  return { name, path: dest };
}

/** Commits no-merge desde una fecha ISO (o todos si no hay cursor). */
function commitsSince(repoPath, sinceIso) {
  const sinceArg = sinceIso ? `--since="${sinceIso}"` : '-n 50';
  const fmt = '%h%x09%an%x09%aI%x09%s';
  let out = '';
  try {
    out = sh(`git log ${sinceArg} --no-merges --pretty=format:"${fmt}"`, repoPath);
  } catch {
    return [];
  }
  return out.split('\n').filter(Boolean).map((l) => {
    const [hash, author, iso, subject] = l.split('\t');
    return { kind: 'commit', hash, author, iso, subject };
  });
}

/** Handoffs de telemetría modificados después de `sinceEpoch`. */
function handoffs(repoPath, sinceEpoch) {
  const dir = path.join(repoPath, 'telemetry', 'handoffs');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== '_TEMPLATE.md')
    .map((f) => {
      const full = path.join(dir, f);
      const mtime = fs.statSync(full).mtimeMs;
      return { f, full, mtime };
    })
    .filter((h) => h.mtime > sinceEpoch)
    .map((h) => ({
      kind: 'handoff',
      file: `telemetry/handoffs/${h.f}`,
      mtime: h.mtime,
      text: fs.readFileSync(h.full, 'utf8').slice(0, 4000),
    }));
}

/**
 * Recolecta eventos nuevos por repo, ESTRICTAMENTE posteriores al cursor
 * (evita reprocesar el commit/handoff del borde). cursor = { [repoName]: lastIso }.
 * Devuelve { events, newCursor }.
 */
export function collectInputs({ repos, reposDir, token, cursor }) {
  const events = [];
  const newCursor = { ...cursor };
  for (const entry of repos) {
    const { name, path: repoPath } = resolveRepo(entry, reposDir, token);
    const since = cursor[name] || null;
    const sinceEpoch = since ? new Date(since).getTime() : 0;

    // Commits estrictamente posteriores al cursor (git --since es inclusivo).
    const commits = commitsSince(repoPath, since).filter(
      (c) => new Date(c.iso).getTime() > sinceEpoch,
    );
    const handoffEvents = handoffs(repoPath, sinceEpoch);

    for (const c of commits) events.push({ repo: name, ...c });
    for (const h of handoffEvents) events.push({ repo: name, ...h });

    // Avanza el cursor al timestamp más reciente visto (commit o handoff).
    const times = [
      ...commits.map((c) => new Date(c.iso).getTime()),
      ...handoffEvents.map((h) => h.mtime),
    ];
    if (times.length) newCursor[name] = new Date(Math.max(...times)).toISOString();
  }
  return { events, newCursor };
}
