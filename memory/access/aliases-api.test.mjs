// node --test memory/access
// Alias de namespaces y catalogo de espacios gestionados desde el portal, y edicion de personas de Coolify.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';

const ADM = 'omnia_adm_token_0123456789abcdef';
const ENVU = 'omnia_env_token_0123456789abcdef';
const MEM = 'omnia_mem_token_0123456789abcdef';
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-alias-'));
let upstream, gw, port;
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

before(async () => {
  upstream = http.createServer((req, res) => {
    req.resume();
    if (req.url.endsWith('/facet')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ result: { hits: [{ value: 'omnia', count: 59 }, { value: 'hr-omnia', count: 39 }, { value: 'omnia-global', count: 84 }, { value: 'int-frutal', count: 3 }] } }));
    }
    res.writeHead(404); res.end();
  });
  const upPort = await listen(upstream);
  gw = createGateway({
    store: createStore({ envText: `envuser:${hashToken(ENVU)}:miembro:int-frutal,mem:${hashToken(MEM)}:miembro:int-frutal`, adminsText: `adm:${hashToken(ADM)}`, file: path.join(dir, 'users.json') }),
    routes: [
      { name: 'mem0', hosts: ['mem.test'], upstream: `http://127.0.0.1:${upPort}`, allow: ['/mcp/'] },
      { name: 'panel', hosts: ['panel.test'], upstream: '', allow: [] },
    ],
    viewerOptions: { qdrantUrl: `http://127.0.0.1:${upPort}`, cacheMs: 0 },
    aliasFile: path.join(dir, 'aliases.json'), aliasEnv: 'legacy=proy-desdecoolify', enforce: true,
  });
  port = await listen(gw);
});
after(() => { gw.closeAllConnections?.(); gw.close(); upstream.closeAllConnections?.(); upstream.close(); });

const call = (method, p, token, body, host = 'panel.test') => new Promise((resolve, reject) => {
  const data = body === undefined ? undefined : JSON.stringify(body);
  const headers = { host, authorization: `Bearer ${token}`, ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}) };
  const req = http.request({ port, host: '127.0.0.1', path: p, method, headers }, (res) => {
    let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch { /* texto */ } resolve({ status: res.statusCode, body: j }); });
  });
  req.on('error', reject); req.end(data);
});

test('namespaces: el admin ve cuantas memorias hay en cada uno y a que espacio corresponde; un miembro no entra', async () => {
  const r = await call('GET', '/api/admin/namespaces', ADM);
  const by = Object.fromEntries(r.body.namespaces.map((n) => [n.namespace, n]));
  assert.deepEqual([by.omnia.count, by.omnia.space], [59, null], 'sin asignar');
  assert.equal(by['omnia-global'].space, 'global');
  assert.equal(by['int-frutal'].space, 'int-frutal');
  assert.deepEqual([by.legacy.space, by.legacy.origin], ['proy-desdecoolify', 'env']);
  assert.equal((await call('GET', '/api/admin/namespaces', MEM)).status, 403);
  assert.equal((await call('GET', '/api/admin/spaces', MEM)).status, 403);
});

test('asignar un namespace antiguo a un espacio desde el portal: se aplica al instante y queda guardado', async () => {
  const set = await call('PUT', '/api/admin/aliases', ADM, { namespace: 'hr-omnia', space: 'int-frutal' });
  assert.equal(set.status, 200);
  const rows = (await call('GET', '/api/admin/namespaces', ADM)).body.namespaces;
  assert.deepEqual(rows.find((n) => n.namespace === 'hr-omnia'), { namespace: 'hr-omnia', count: 39, space: 'int-frutal', aliased: true, origin: 'file' });
  assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'aliases.json'), 'utf8')).aliases, { 'hr-omnia': 'int-frutal' });
  const sp = (await call('GET', '/api/admin/spaces', ADM)).body.spaces.map((s) => s.id);
  assert.ok(['global', 'int-frutal', 'proy-desdecoolify'].every((s) => sp.includes(s)), 'el catalogo reune lo que ya existe');
  assert.equal((await call('DELETE', '/api/admin/aliases/hr-omnia', ADM)).status, 200);
  assert.equal((await call('GET', '/api/admin/namespaces', ADM)).body.namespaces.find((n) => n.namespace === 'hr-omnia').space, null);
});

test('alias invalidos se rechazan sin dejar nada a medias; los de Coolify no se tocan', async () => {
  for (const bad of [{ namespace: 'x', space: 'global' }, { namespace: 'x', space: 'sin-prefijo' }, { namespace: 'int-a', space: 'int-b' }, { namespace: 'Mayus', space: 'int-x' }, { namespace: 'omnia', space: 'proy-desdecoolify' }, {}]) {
    assert.equal((await call('PUT', '/api/admin/aliases', ADM, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call('PUT', '/api/admin/aliases', ADM, { namespace: 'legacy', space: 'int-otro' })).status, 409);
  assert.equal((await call('DELETE', '/api/admin/aliases/legacy', ADM)).status, 409);
  assert.equal((await call('DELETE', '/api/admin/aliases/nunca', ADM)).status, 404);
  assert.equal((await call('PUT', '/api/admin/aliases', MEM, { namespace: 'omnia', space: 'proy-x' })).status, 403, 'solo un admin');
  const rows = (await call('GET', '/api/admin/namespaces', ADM)).body.namespaces;
  assert.equal(rows.find((n) => n.namespace === 'omnia').space, null, 'nada quedo aplicado');
});

test('editar a una persona de Coolify la migra sola al portal y conserva su token', async () => {
  const before = (await call('GET', '/api/admin/users', ADM)).body.users.find((u) => u.id === 'envuser');
  assert.equal(before.editable, false);
  const r = await call('PATCH', '/api/admin/users/envuser', ADM, { role: 'miembro', spaces: ['int-frutal', 'proy-omniapos'] });
  assert.equal(r.status, 200);
  assert.deepEqual((await call('GET', '/api/me', ENVU)).body.spaces, ['int-frutal', 'proy-omniapos'], 'su mismo token, espacios nuevos');
  assert.equal((await call('GET', '/api/admin/users', ADM)).body.users.find((u) => u.id === 'envuser').editable, true);
  assert.equal((await call('PATCH', '/api/admin/users/adm', ADM, { role: 'lectura' })).status, 409, 'el admin de emergencia no se edita');
});
