// node --test memory/access
// Alias de proyectos de Basic Memory y modo de permisos (bloquear / solo registrar), todo desde el portal.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';
import { configureKbAliases, checkKbRpc, spaceFromKbProject } from './policy.mjs';

const ADM = 'omnia_adm_token_0123456789abcdef';
const MEM = 'omnia_mem_token_0123456789abcdef';
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-cfg-'));
const miembro = { role: 'miembro', spaces: ['int-frutal'] };
const call = (user, name, args) => checkKbRpc(user, [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }]);

test('alias de Basic Memory: un proyecto antiguo cuenta como su espacio y el nombre propio sigue valiendo', () => {
  configureKbAliases('');
  assert.equal(call(miembro, 'read_note', { project: 'projects', identifier: 'x' }).ok, false, 'sin alias: un proyecto sin nombre de espacio se deniega');
  configureKbAliases('projects=int-frutal, main = proy-omniapos');
  assert.equal(spaceFromKbProject('projects'), 'int-frutal');
  assert.equal(call(miembro, 'read_note', { project: 'projects', identifier: 'x' }).ok, true, 'con alias a su espacio: pasa');
  assert.equal(call(miembro, 'read_note', { project: 'main', identifier: 'x' }).ok, false, 'alias a otro espacio: no');
  assert.equal(call(miembro, 'read_note', { project: 'int-frutal', identifier: 'x' }).ok, true, 'el nombre propio sigue valiendo');
  assert.equal(call({ role: 'cliente', spaces: ['cli-frutal'] }, 'read_note', { project: 'projects', identifier: 'x' }).ok, false, 'un cliente no entra a un proyecto interno');
  assert.equal(call(miembro, 'read_note', { project: 'projects', identifier: 'memory://main/x' }).ok, false, 'memory:// de otro proyecto sigue bloqueado');
  for (const bad of ['global=int-a', 'x=global', 'Mayus=int-a', 'a=b=c', 'p=int-a,p=int-b']) assert.throws(() => configureKbAliases(bad), /alias/, bad);
  configureKbAliases('');
});

let upstream, gw, port;
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));
before(async () => {
  upstream = http.createServer((req, res) => {
    req.resume();
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: endpoint\r\ndata: /messages/?session_id=sess0123456789\r\n\r\n');
      return;
    }
    res.writeHead(202);
    res.end('ok');
  });
  const upPort = await listen(upstream);
  gw = createGateway({
    store: createStore({ envText: `mem:${hashToken(MEM)}:miembro:int-frutal`, adminsText: `adm:${hashToken(ADM)}`, file: path.join(dir, "users.json") }),
    routes: [
      { name: 'mem0', hosts: ['mem.test'], upstream: `http://127.0.0.1:${upPort}`, allow: ['/mcp/'] },
      { name: 'panel', hosts: ['panel.test'], upstream: '', allow: [] },
    ],
    aliasFile: path.join(dir, 'aliases.json'),
  });
  port = await listen(gw);
});
after(() => { gw.closeAllConnections?.(); gw.close(); upstream.closeAllConnections?.(); upstream.close(); });

const req = (method, p, token, body, host = 'panel.test') => new Promise((resolve, reject) => {
  const data = body === undefined ? undefined : JSON.stringify(body);
  const r = http.request({ port, host: '127.0.0.1', path: p, method, headers: { host, authorization: `Bearer ${token}`, ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}) } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch { /* texto */ } resolve({ status: res.statusCode, body: j }); });
  });
  r.on('error', reject);
  r.end(data);
});
// Abre la conexion SSE y devuelve solo el codigo (no espera a que termine el flujo).
const sse = (ns) => new Promise((resolve) => {
  const r = http.get({ port, host: '127.0.0.1', path: `/mcp/claude/sse/${ns}`, headers: { host: 'mem.test', authorization: `Bearer ${MEM}`, accept: 'text/event-stream' } }, (res) => { resolve(res.statusCode); res.destroy(); });
  r.on('error', () => resolve(0));
});

test('modo de permisos desde el portal: auditoria registra lo que bloquearia; activarlo bloquea al instante y se puede revertir', async () => {
  const s0 = (await req('GET', '/api/admin/settings', ADM)).body;
  assert.deepEqual([s0.enforce, s0.enforcedByEnv, s0.wouldDeny.total], [false, false, 0]);
  assert.equal(await sse('int-frutal'), 200, 'su espacio entra');
  assert.equal(await sse('cli-weritas'), 200, 'en auditoria pasa aunque no deba');
  const s1 = (await req('GET', '/api/admin/settings', ADM)).body;
  assert.equal(s1.wouldDeny.total, 1);
  assert.deepEqual([s1.wouldDeny.recent[0].dev, s1.wouldDeny.recent[0].reason], ['mem', 'sin_acceso_al_espacio']);

  assert.equal((await req('PUT', '/api/admin/settings', ADM, { enforce: 'si' })).status, 400, 'solo verdadero o falso');
  assert.equal((await req('PUT', '/api/admin/settings', MEM, { enforce: true })).status, 403, 'solo un admin');
  assert.equal((await req('PUT', '/api/admin/settings', ADM, { enforce: true })).status, 200);
  assert.equal(await sse('cli-weritas'), 403, 'ahora bloquea, sin redeploy');
  assert.equal(await sse('int-frutal'), 200, 'y lo permitido sigue funcionando');
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'aliases.json'), 'utf8')).enforce, true, 'queda guardado');

  assert.equal((await req('PUT', '/api/admin/settings', ADM, { enforce: false })).status, 200);
  assert.equal(await sse('cli-weritas'), 200, 'revertir vuelve a auditoria');
});

test('alias de Basic Memory desde el portal: se guardan aparte de los de Mem0 y no cortan conexiones', async () => {
  const set = await req('PUT', '/api/admin/aliases', ADM, { kind: 'kb', namespace: 'projects', space: 'int-frutal' });
  assert.equal(set.status, 200);
  assert.equal(set.body.sesiones_cerradas, 0);
  assert.equal(spaceFromKbProject('projects'), 'int-frutal');
  const file = JSON.parse(readFileSync(path.join(dir, 'aliases.json'), 'utf8'));
  assert.deepEqual([file.kb, file.mem0], [{ projects: 'int-frutal' }, {}]);
  assert.equal((await req('PUT', '/api/admin/aliases', ADM, { kind: 'kb', namespace: 'x', space: 'global' })).status, 400);
  assert.equal((await req('DELETE', '/api/admin/aliases/projects?kind=kb', ADM)).status, 200);
  assert.equal(spaceFromKbProject('projects'), null);
  assert.equal((await req('DELETE', '/api/admin/aliases/projects?kind=kb', ADM)).status, 404);
});
