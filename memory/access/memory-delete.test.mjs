// node --test memory/access
// Borrar memorias desde el portal: solo admin, solo dentro del namespace pedido, deja registro de lo borrado.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';

const ADM = 'omnia_adm_token_0123456789abcdef';
const MEM = 'omnia_mem_token_0123456789abcdef';
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-del-'));
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
let points, deleteBodies, upstream, gw, port, logs;
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

// Qdrant falso que aplica de verdad el filtro: namespace (user_id) Y lista de ids.
const matches = (filter, p) => filter.must.every((c) => (c.key === 'user_id' ? p.payload.user_id === c.match.value : c.has_id.includes(p.id)));

before(async () => {
  points = [
    { id: A, payload: { user_id: 'omnia', data: 'basura A' } },
    { id: B, payload: { user_id: 'omnia', data: 'basura B' } },
    { id: OTHER, payload: { user_id: 'int-frutal', data: 'de otro namespace' } },
  ];
  deleteBodies = [];
  logs = [];
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      const q = body ? JSON.parse(body) : {};
      if (req.url.startsWith('/collections/openmemory/points/scroll')) return res.end(JSON.stringify({ result: { points: points.filter((p) => matches(q.filter, p)), next_page_offset: null } }));
      if (req.url.startsWith('/collections/openmemory/points/delete')) {
        deleteBodies.push(q);
        points = points.filter((p) => !matches(q.filter, p));
        return res.end(JSON.stringify({ result: { status: 'completed' } }));
      }
      res.end('{}');
    });
  });
  const upPort = await listen(upstream);
  gw = createGateway({
    store: createStore({ envText: `mem:${hashToken(MEM)}:miembro:int-frutal`, adminsText: `adm:${hashToken(ADM)}`, file: path.join(dir, 'users.json') }),
    routes: [{ name: 'panel', hosts: ['panel.test'], upstream: '', allow: [] }],
    viewerOptions: { qdrantUrl: `http://127.0.0.1:${upPort}`, cacheMs: 0 },
    aliasFile: path.join(dir, 'aliases.json'), aliasEnv: 'omnia=proy-omniapos', enforce: true, log: (e) => logs.push(e),
  });
  port = await listen(gw);
});
after(() => { gw.closeAllConnections?.(); gw.close(); upstream.closeAllConnections?.(); upstream.close(); });

const post = (token, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const r = http.request({ port, host: '127.0.0.1', path: '/api/admin/memories/delete', method: 'POST', headers: { host: 'panel.test', authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || 'null') }));
  });
  r.on('error', reject);
  r.end(data);
});

test('solo un admin borra, y los datos invalidos se rechazan sin tocar nada', async () => {
  assert.equal((await post(MEM, { space: 'proy-omniapos', ids: [A] })).status, 403);
  for (const bad of [{ space: 'proy-omniapos', ids: [] }, { space: 'proy-omniapos', ids: ['no es un id'] }, { space: 'proy-omniapos' }, { space: 'proy-omniapos', ids: Array(201).fill(A) }, { space: 'no-existe-x', ids: [A] }, { space: 'ns:omnia', ids: [A] }]) {
    const r = await post(ADM, bad);
    assert.ok([400, 404].includes(r.status), `${JSON.stringify(bad).slice(0, 60)} -> ${r.status}`);
  }
  assert.equal(points.length, 3);
  assert.equal(deleteBodies.length, 0);
});

test('borra por espacio (aunque tenga alias), devuelve lo borrado y deja registro', async () => {
  const r = await post(ADM, { space: 'proy-omniapos', ids: [A, B, A] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.removed.map((x) => [x.id, x.content]).sort(), [[A, 'basura A'], [B, 'basura B']]);
  assert.equal(r.body.missing, 0);
  assert.deepEqual(points.map((p) => p.id), [OTHER]);
  assert.deepEqual(deleteBodies[0].filter.must[0], { key: 'user_id', match: { value: 'omnia' } }, 'el borrado siempre lleva el namespace');
  const audit = logs.find((l) => l.action === 'borrar_memorias');
  assert.deepEqual([audit.by, audit.target, audit.borradas, audit.ids.sort()], ['adm', 'proy-omniapos', 2, [A, B]]);
});

test('un id de OTRO namespace no se borra aunque se pida; y uno inexistente solo cuenta como faltante', async () => {
  const r = await post(ADM, { space: 'proy-omniapos', ids: [OTHER, '44444444-4444-4444-4444-444444444444'] });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.removed.length, r.body.missing], [0, 2]);
  assert.deepEqual(points.map((p) => p.id), [OTHER], 'lo de int-frutal sigue ahi');
});
