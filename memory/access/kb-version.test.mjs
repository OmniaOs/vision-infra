// node --test memory/access
// Defensa ante cambios de version de Basic Memory: la foto de sus herramientas (kb-tools.snapshot.json) debe estar
// completamente cubierta por la politica. Si actualizas Basic Memory: node kb-tools-snapshot.mjs (compara) y revisa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkKbRpc, KB_TOOLS } from './policy.mjs';
import { diffSnapshots, summarize } from './kb-tools-snapshot.mjs';

const snapshot = JSON.parse(readFileSync(new URL('./kb-tools.snapshot.json', import.meta.url), 'utf8'));
const member = { id: 'm', role: 'miembro', spaces: ['int-frutal'] };
const lector = { id: 'l', role: 'lectura', spaces: ['int-frutal'] };
const cliente = { id: 'c', role: 'cliente', spaces: ['cli-frutal'] };
const call = (user, name, args) => checkKbRpc(user, [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }]);
const allowed = new Set([...KB_TOOLS.read, ...KB_TOOLS.write]);

test('cada herramienta de la foto esta clasificada: permitida con filtro o denegada a quien no es admin', () => {
  for (const name of Object.keys(snapshot)) {
    const r = call(member, name, { project: 'int-frutal' });
    if (allowed.has(name)) assert.equal(r.ok, true, `${name} deberia pasar con su proyecto`);
    else assert.equal(r.ok, false, `${name} no esta en la lista blanca: debe denegarse`);
  }
  for (const name of allowed) assert.ok(snapshot[name], `${name} esta en la politica pero ya no existe en Basic Memory: revisa la politica`);
});

test('todo parametro de alcance de una herramienta permitida esta bloqueado o controlado', () => {
  const SCOPE = /project|workspace|all_projects|url|destination|source|path|dir/i;
  const known = new Set(['project', 'project_id', 'workspace', 'search_all_projects', 'identifier', 'url', 'destination_path', 'destination_folder', 'is_directory', 'dir_name', 'directory', 'path']);
  for (const name of allowed) {
    for (const param of Object.keys(snapshot[name].params)) {
      if (SCOPE.test(param)) assert.ok(known.has(param), `${name}.${param}: parametro de alcance NUEVO, la politica no lo conoce`);
    }
  }
  for (const [name, tool] of Object.entries(snapshot)) {
    if (!allowed.has(name)) continue;
    if ('project_id' in tool.params) assert.equal(call(member, name, { project: 'int-frutal', project_id: 'x' }).ok, false, `${name}: project_id debe bloquearse`);
    if ('workspace' in tool.params) assert.equal(call(member, name, { project: 'int-frutal', workspace: 'x' }).ok, false, `${name}: workspace debe bloquearse`);
    if ('search_all_projects' in tool.params) assert.equal(call(member, name, { project: 'int-frutal', search_all_projects: true }).ok, false);
    assert.equal(call(member, name, { project: 'cli-frutal' }).ok, false, `${name}: otro proyecto debe bloquearse`);
    assert.equal(call(member, name, {}).ok, false, `${name}: sin proyecto debe bloquearse`);
    assert.equal(call(member, name, { project: 'int-frutal', identifier: 'memory://cli-frutal/x', url: 'memory://cli-frutal/x', path: '../x' }).ok, false, `${name}: memory:// ajeno o ..`);
    for (const key of ['destination_path', 'destination_folder', 'is_directory', 'dir_name', 'directory']) {
      if (key in tool.params) assert.equal(call(member, name, { project: 'int-frutal', [key]: '../../cli-frutal/x' }).ok, false, `${name}.${key}: salida de la carpeta del proyecto`);
    }
  }
});

test('lectura no escribe; cliente solo usa el conjunto minimo y solo en su proyecto', () => {
  for (const name of KB_TOOLS.write) assert.equal(call(lector, name, { project: 'int-frutal' }).ok, false, `${name} no para solo lectura`);
  for (const name of Object.keys(snapshot)) {
    const r = call(cliente, name, { project: 'cli-frutal' });
    assert.equal(r.ok, KB_TOOLS.client.has(name), `${name} para cliente`);
    if (KB_TOOLS.client.has(name)) assert.equal(call(cliente, name, { project: 'int-frutal' }).ok, false, `${name}: cliente fuera de su proyecto`);
  }
  for (const name of ['build_context', 'move_note', 'read_content', 'delete_note', 'schema_infer']) assert.equal(call(cliente, name, { project: 'cli-frutal' }).ok, false, name);
});

test('el comparador de fotos avisa de herramientas y parametros nuevos', () => {
  const tools = Object.entries(snapshot).map(([name, t]) => ({ name, inputSchema: { properties: Object.fromEntries(Object.entries(t.params).map(([k, v]) => [k, { type: v }])), required: t.required } }));
  assert.deepEqual(diffSnapshots(snapshot, summarize(tools)), [], 'una foto igual a si misma no cambia');
  const changed = tools.map((t) => (t.name === 'read_note' ? { ...t, inputSchema: { ...t.inputSchema, properties: { ...t.inputSchema.properties, other_project: { type: 'string' } } } } : t));
  changed.push({ name: 'export_all', inputSchema: { properties: { everything: { type: 'boolean' } } } });
  const lines = diffSnapshots(snapshot, summarize(changed));
  assert.ok(lines.some((l) => /NUEVA: export_all/.test(l)) && lines.some((l) => /read_note: parametro NUEVO other_project/.test(l)));
});
