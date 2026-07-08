#!/usr/bin/env node
/**
 * ingest-approved.mjs — Ingiere a Mem0 las propuestas YA APROBADAS (mergeadas).
 *
 * Corre después de mergear un PR de propuestas de Hermes (p.ej. por GitHub
 * Action on-merge, o manual). Lee proposals/<fecha>.md y crea las memorias en
 * OpenMemory vía su API. Esta es la ÚNICA vía por la que contenido de Hermes
 * entra a la memoria compartida — nunca sin aprobación.
 *
 * Uso: node ingest-approved.mjs proposals/2026-07-07.md
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Uso: node ingest-approved.mjs <proposals/fecha.md>');
  process.exit(1);
}

const API = process.env.OMNIA_MEMORY_MCP_URL;
const KEY = process.env.OPENMEMORY_API_KEY;
const USER = process.env.OMNIA_MEMORY_DEFAULT_USER || 'omnia';
if (!API || !KEY) {
  console.error('Faltan OMNIA_MEMORY_MCP_URL / OPENMEMORY_API_KEY.');
  process.exit(1);
}

// Parseo simple: cada "## N. Título" + cuerpo hasta el siguiente "## " es una memoria.
const md = fs.readFileSync(file, 'utf8');
const blocks = md.split(/^## \d+\.\s+/m).slice(1);
const memories = blocks.map((b) => {
  const [titleLine, ...rest] = b.split('\n');
  return `${titleLine.trim()} — ${rest.join(' ').replace(/\*\*[^*]+\*\*/g, '').trim()}`.slice(0, 1000);
});

const failures = [];
for (const text of memories) {
  try {
    const res = await fetch(`${API.replace(/\/$/, '')}/api/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ user_id: USER, text }),
    });
    if (!res.ok) failures.push(`${res.status} ${text.slice(0, 40)}`);
  } catch (e) {
    failures.push(`${e.message} ${text.slice(0, 40)}`);
  }
}
console.log(`Ingeridas ${memories.length - failures.length}/${memories.length} memorias.`);
if (failures.length) {
  console.error('Fallos:\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
