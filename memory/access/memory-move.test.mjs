// node --test memory/access
// Listar con paginas y mover memorias entre namespaces desde el portal: solo admin, el origen viaja con los ids, queda registro.
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
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-mov-'));
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [A, B, C, OTHER] = [id(1), id(2), id(3), id(4)];
let points, setBodies, upstream, gw, port, logs;
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

// Qdrant falso que aplica de verdad el filtro (namespace y/o ids), la paginacion por offset y el cambio de payload.
const matches = (filter, p) => (filter?.must ?? []).every((c) => (c.key === 'user_id' ? p.payload.user_id === c.match.value : c.has_id.includes(p.id)));

before(async () => {
  points = [
    { id: A, payload: { user_id: 'hr-omnia', data: 'regla del ERP A', created_at: '2026-09-01' } },
    { id: B, payload: { user_id: 'hr-omnia', data: 'regla del ERP B', created_at: '2026-09-02' } },
    { id: C, payload: { user_id: 'hr-omnia', data: 'regla de RH C', created_at: '2026-09-03' } },
    { id: OTHER, payload: { user_id: 'omnia-global', data: 'del global', created_at: '2026-09-04' } },
    ...[10, 11, 12, 13, 14].map((n) => ({ id: id(n), payload: { user_id: 'pag', data: `pagina ${n}`, created_at: `2026-10-${n}` } })),
  ];
  setBodies = [];
  logs = [];
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      const q = body ? JSON.parse(body) : {};
      if (req.url.startsWith('/collections/openmemory/points/scroll')) {
        const all = points.filter((p) => matches(q.filter, p));
        const start = q.offset ? all.findIndex((p) => p.id === q.offset) : 0;
        const page = all.slice(start, start + q.limit);
        const next = all[start + q.limit]?.id ?? null;
        return res.end(JSON.stringify({ result: { points: page, next_page_offset: next } }));
      }
      if (req.url.startsWith('/collections/openmemory/points/payload')) {
        setBodies.push(q);
        for (const p of points.filter((x) => matches(q.filter, x))) Object.assign(p.payload, q.payload);
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
    aliasFile: path.join(dir, 'aliases.json'), aliasEnv: 'hr-omnia=int-frutal', enforce: true, log: (e) => logs.push(e),
  });
  port = await listen(gw);
});
after(() => { gw.closeAllConnections?.(); gw.close(); upstream.closeAllConnections?.(); upstream.close(); });

const call = (method, p, token, body) => new Promise((resolve, reject) => {
  const data = body === undefined ? '' : JSON.stringify(body);
  const r = http.request({ port, host: '127.0.0.1', path: p, method, headers: { host: 'panel.test', authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || 'null') }));
  });
  r.on('error', reject);
  r.end(data);
});
const move = (token, body) => call('POST', '/api/admin/memories/move', token, body);
const owner = (pid) => points.find((p) => p.id === pid).payload.user_id;

test('solo un admin lista y mueve, y los datos invalidos se rechazan sin tocar nada', async () => {
  assert.equal((await move(MEM, { from: 'hr-omnia', to: 'int-frutal', ids: [A] })).status, 403);
  assert.equal((await call('GET', '/api/admin/memories?namespace=hr-omnia', MEM)).status, 403);
  for (const bad of [
    { from: 'hr-omnia', to: 'hr-omnia', ids: [A] }, { from: 'Hr Omnia', to: 'int-frutal', ids: [A] }, { from: 'hr-omnia', to: '../x', ids: [A] },
    { from: 'hr-omnia', to: 'int-frutal', ids: [] }, { from: 'hr-omnia', to: 'int-frutal', ids: ['no es un id'] }, { from: 'hr-omnia', to: 'int-frutal' },
    { from: 'hr-omnia', to: 'int-frutal', ids: Array(201).fill(A) },
  ]) assert.equal((await move(ADM, bad)).status, 400, JSON.stringify(bad).slice(0, 70));
  assert.equal((await call('GET', '/api/admin/memories', ADM)).status, 400, 'sin namespace');
  assert.equal((await call('GET', '/api/admin/memories?namespace=pag&cursor=no%20es%20id', ADM)).status, 400, 'cursor raro');
  assert.equal(setBodies.length, 0);
  assert.deepEqual([A, B, C].map(owner), ['hr-omnia', 'hr-omnia', 'hr-omnia']);
});

test('mueve de un namespace a otro conservando id y texto, solo lo pedido, y deja registro', async () => {
  const r = await move(ADM, { from: 'hr-omnia', to: 'int-frutal', ids: [A, B, A] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.moved.map((x) => [x.id, x.content]).sort(), [[A, 'regla del ERP A'], [B, 'regla del ERP B']]);
  assert.equal(r.body.missing, 0);
  assert.deepEqual([A, B, C, OTHER].map(owner), ['int-frutal', 'int-frutal', 'hr-omnia', 'omnia-global'], 'C y lo del global no se tocan');
  assert.equal(points.find((p) => p.id === A).payload.data, 'regla del ERP A');
  assert.equal(points.find((p) => p.id === A).payload.created_at, '2026-09-01', 'conserva la fecha');
  assert.deepEqual(setBodies[0].filter.must[0], { key: 'user_id', match: { value: 'hr-omnia' } }, 'el cambio siempre lleva el namespace de origen');
  const audit = logs.find((l) => l.action === 'mover_memorias');
  assert.deepEqual([audit.by, audit.target, audit.movidas, audit.ids.sort()], ['adm', 'hr-omnia->int-frutal', 2, [A, B]]);
});

test('un id que ya no esta en el origen no se mueve: cuenta como faltante (y mover dos veces no rompe nada)', async () => {
  const r = await move(ADM, { from: 'hr-omnia', to: 'int-frutal', ids: [A, OTHER, id(99)] });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.moved.length, r.body.missing], [0, 3]);
  assert.equal(owner(OTHER), 'omnia-global');
});

test('lista por paginas sin tope: cada pagina trae lo suyo y el cursor lleva a la siguiente', async () => {
  const seen = [];
  let cursor = null;
  for (let page = 0; page < 5; page++) {
    const r = await call('GET', `/api/admin/memories?namespace=pag&limit=2${cursor ? `&cursor=${cursor}` : ''}`, ADM);
    assert.equal(r.status, 200);
    assert.ok(r.body.memories.every((m) => m.content.startsWith('pagina')), 'solo de ese namespace');
    seen.push(...r.body.memories.map((m) => m.id));
    cursor = r.body.next;
    if (!cursor) break;
  }
  assert.deepEqual(seen, [10, 11, 12, 13, 14].map(id));
  assert.equal(cursor, null, 'la ultima pagina cierra');
});
