// Foto de las herramientas de Basic Memory (nombres y parametros) y comparacion con la foto guardada.
//
//   node kb-tools-snapshot.mjs            compara el Basic Memory real con kb-tools.snapshot.json (sale 1 si cambio)
//   node kb-tools-snapshot.mjs --write    guarda la foto actual (solo tras REVISAR el cambio y actualizar policy.mjs)
//
// Variables: OMNIA_MEMORY_TOKEN (token de admin), KB_URL (por defecto https://kb.omniaos.ai).
// Hacerlo ANTES de actualizar la imagen de Basic Memory: una herramienta o un parametro nuevo puede abrir un camino
// entre proyectos que el filtro del gateway (policy.mjs) aun no conoce.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listMcpTools } from './mcp-client.mjs';

const FILE = fileURLToPath(new URL('./kb-tools.snapshot.json', import.meta.url));

/** Solo lo que importa para el alcance: nombre, parametros (tipo) y obligatorios. Sin descripciones. */
export function summarize(tools) {
  const out = {};
  for (const t of [...tools].sort((a, b) => a.name.localeCompare(b.name))) {
    const props = t.inputSchema?.properties || {};
    out[t.name] = {
      params: Object.fromEntries(Object.keys(props).sort().map((k) => [k, props[k].type || (props[k].anyOf ? props[k].anyOf.map((x) => x.type).filter(Boolean).sort().join('|') : 'any')])),
      required: [...(t.inputSchema?.required || [])].sort(),
    };
  }
  return out;
}

/** Diferencias entre dos fotos, en frases legibles. */
export function diffSnapshots(saved, current) {
  const lines = [];
  for (const name of Object.keys(current)) if (!saved[name]) lines.push(`herramienta NUEVA: ${name} (${Object.keys(current[name].params).join(', ')})`);
  for (const name of Object.keys(saved)) {
    if (!current[name]) { lines.push(`herramienta QUITADA: ${name}`); continue; }
    for (const p of Object.keys(current[name].params)) if (!(p in saved[name].params)) lines.push(`${name}: parametro NUEVO ${p}`);
    for (const p of Object.keys(saved[name].params)) if (!(p in current[name].params)) lines.push(`${name}: parametro quitado ${p}`);
    for (const p of Object.keys(current[name].params)) if (p in saved[name].params && saved[name].params[p] !== current[name].params[p]) lines.push(`${name}: ${p} cambio de tipo`);
  }
  return lines;
}

if (process.argv[1]?.endsWith('kb-tools-snapshot.mjs')) {
  const token = process.env.OMNIA_MEMORY_TOKEN;
  if (!token) { console.error('Falta OMNIA_MEMORY_TOKEN (token de admin)'); process.exit(2); }
  const tools = await listMcpTools({ base: process.env.KB_URL || 'https://kb.omniaos.ai', auth: `Bearer ${token}` });
  const current = summarize(tools);
  if (process.argv.includes('--write')) {
    writeFileSync(FILE, JSON.stringify(current, null, 2) + '\n');
    console.log(`Foto guardada: ${Object.keys(current).length} herramientas`);
  } else {
    const changes = diffSnapshots(JSON.parse(readFileSync(FILE, 'utf8')), current);
    if (changes.length === 0) console.log(`Sin cambios: ${Object.keys(current).length} herramientas igual que la foto.`);
    else { console.log('Basic Memory CAMBIO. Revisa policy.mjs antes de actualizar:\n- ' + changes.join('\n- ')); process.exit(1); }
  }
}
