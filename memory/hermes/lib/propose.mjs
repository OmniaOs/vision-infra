/**
 * propose.mjs — Materializa las propuestas de memoria para APROBACIÓN HUMANA.
 *
 * v1 (gate humano): escribe proposals/<fecha>.md y abre un PR contra el repo de
 * propuestas. Aprobar = mergear el PR. Un paso aparte (ingest-approved.mjs)
 * ingiere lo aprobado a Mem0. Hermes NUNCA escribe directo a la memoria.
 *
 * En --dry-run escribe el markdown localmente y no toca GitHub.
 */
import fs from 'node:fs';
import path from 'node:path';

export function renderMarkdown(proposals, dateStr) {
  const lines = [
    `# Propuestas de memoria — ${dateStr}`,
    '',
    '> Generadas por Hermes. Revisa y **mergea este PR** para aprobar; lo aprobado',
    '> se ingiere a la memoria compartida (Mem0). Borra las que no apliquen.',
    '',
  ];
  proposals.forEach((p, i) => {
    lines.push(`## ${i + 1}. ${p.title}`);
    lines.push('');
    lines.push(p.body);
    lines.push('');
    if (p.tags?.length) lines.push(`**tags:** ${p.tags.join(', ')}`);
    if (p.sources?.length) lines.push(`**fuentes:** ${p.sources.join(', ')}`);
    lines.push('');
  });
  return lines.join('\n');
}

async function gh(token, method, url, body) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${url} → ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Abre un PR con las propuestas en HERMES_PROPOSALS_REMOTE (owner/repo). */
async function openPR({ token, remote, dateStr, markdown }) {
  const filePath = `proposals/${dateStr}.md`;
  const branch = `hermes/proposals-${dateStr}`;
  const repoInfo = await gh(token, 'GET', `/repos/${remote}`);
  const base = repoInfo.default_branch;
  const ref = await gh(token, 'GET', `/repos/${remote}/git/ref/heads/${base}`);
  const baseSha = ref.object.sha;

  // Crea la rama (ignora si ya existe)
  try {
    await gh(token, 'POST', `/repos/${remote}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });
  } catch { /* la rama ya existía */ }

  // Crea/actualiza el archivo en la rama
  let existingSha;
  try {
    const existing = await gh(token, 'GET', `/repos/${remote}/contents/${filePath}?ref=${branch}`);
    existingSha = existing.sha;
  } catch { /* no existe aún */ }
  await gh(token, 'PUT', `/repos/${remote}/contents/${filePath}`, {
    message: `Hermes: propuestas de memoria ${dateStr}`,
    content: Buffer.from(markdown, 'utf8').toString('base64'),
    branch,
    sha: existingSha,
  });

  // Abre el PR (ignora si ya existe uno para la rama)
  try {
    const pr = await gh(token, 'POST', `/repos/${remote}/pulls`, {
      title: `Hermes: propuestas de memoria ${dateStr}`,
      head: branch,
      base,
      body: 'Revisa y mergea para aprobar. Lo aprobado se ingiere a Mem0.',
    });
    return pr.html_url;
  } catch (e) {
    return `(PR ya existente o error al crear: ${String(e).split('\n')[0]})`;
  }
}

export async function propose(proposals, { dryRun, stateDir, token, remote, dateStr }) {
  const markdown = renderMarkdown(proposals, dateStr);

  if (dryRun || !token || !remote) {
    const dir = path.join(stateDir, 'proposals');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${dateStr}.md`);
    fs.writeFileSync(out, markdown, 'utf8');
    return { mode: 'local', path: out };
  }

  const url = await openPR({ token, remote, dateStr, markdown });
  return { mode: 'pr', url };
}
