// node --test memory/access
// Politicas aplicadas a traves del gateway completo, con un backend simulado.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';

const T = {
  ana: 'omnia_ana_token_0123456789abcdef', leo: 'omnia_leo_token_0123456789abcdef',
  cli: 'omnia_cli_token_0123456789abcdef', adm: 'omnia_adm_token_0123456789abcdef',
};
const envText = [
  `ana:${hashToken(T.ana)}:miembro:int-frutal`,
  `leo:${hashToken(T.leo)}:lectura:int-frutal`,
  `cli:${hashToken(T.cli)}:cliente:cli-frutal`,
].join(',');
const adminsText = `adm:${hashToken(T.adm)}`;

const backendSeen = [];
let upstream, upPort, sidCounter = 0;
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const servers = [];

before(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      backendSeen.push({ url: req.url, body });
      if (req.method === 'GET') {
        const sid = `sess${String(++sidCounter).padStart(8, '0')}`;
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(`event: endpoint\r\ndata: /messages/?session_id=${sid}\r\n\r\n`);
        return; // la conexion queda abierta como una sesion real
      }
      res.writeHead(202);
      res.end('Accepted');
    });
  });
  upPort = await listen(upstream);
});

after(() => {
  for (const s of servers) { s.closeAllConnections?.(); s.close(); }
  upstream.closeAllConnections?.();
  upstream.close();
});

async function gateway(enforce, extra = {}) {
  const logs = [];
  const gw = createGateway({
    store: createStore({ envText, adminsText }),
    routes: [
      { name: 'mem0', hosts: ['mem.test'], upstream: `http://127.0.0.1:${upPort}`, allow: ['/mcp/'] },
      { name: 'knowledge', hosts: ['kb.test'], upstream: `http://127.0.0.1:${upPort}`, allow: ['/'] },
    ],
    enforce, log: (e) => logs.push(e), ...extra,
  });
  servers.push(gw);
  const port = await listen(gw);
  return { gw, port, logs };
}

/** Abre una sesion SSE. Devuelve { status, sid, close }. */
function openSse(port, host, p, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      port, host: '127.0.0.1', path: p,
      headers: { host, authorization: `Bearer ${token}`, accept: 'text/event-stream' },
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve({ status: res.statusCode, close() {} }); }
      res.once('data', (c) => {
        const sid = /session_id=([A-Za-z0-9_-]+)/.exec(c.toString())?.[1];
        resolve({ status: 200, sid, close: () => req.destroy(), res });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function postRaw(port, host, p, token, rawBody) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      port, host: '127.0.0.1', path: p, method: 'POST',
      headers: { host, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(rawBody) },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    });
    req.on('error', reject);
    req.end(rawBody);
  });
}
const postRpc = (port, host, p, token, msg) => postRaw(port, host, p, token, JSON.stringify(msg));
const tool = (name, args = {}) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

test('Mem0 enforce: conexion solo a espacios propios', async () => {
  const { port } = await gateway(true);
  const own = await openSse(port, 'mem.test', '/mcp/claude/sse/int-frutal', T.ana);
  const other = await openSse(port, 'mem.test', '/mcp/claude/sse/int-weritas', T.ana);
  const legacy = await openSse(port, 'mem.test', '/mcp/claude/sse/frutal', T.ana);
  const cliGlobal = await openSse(port, 'mem.test', '/mcp/claude/sse/omnia-global', T.cli);
  own.close();
  assert.equal(own.status, 200);
  assert.equal(other.status, 403);
  assert.equal(legacy.status, 403);
  assert.equal(cliGlobal.status, 403);
});

test('Mem0 enforce: los mensajes se validan contra el espacio de SU sesion', async () => {
  const { port } = await gateway(true);
  const s = await openSse(port, 'mem.test', '/mcp/claude/sse/int-frutal', T.ana);
  backendSeen.length = 0;
  const p = `/mcp/messages/?session_id=${s.sid}`;
  assert.equal((await postRpc(port, 'mem.test', p, T.ana, tool('add_memories', { text: 'x' }))).status, 202);
  assert.equal((await postRpc(port, 'mem.test', p, T.ana, tool('delete_all_memories'))).status, 403);
  assert.equal((await postRpc(port, 'mem.test', p, T.leo, tool('search_memory'))).status, 403, 'otro dev no usa la sesion ajena');
  assert.equal((await postRpc(port, 'mem.test', '/mcp/messages/?session_id=inventada0000', T.ana, tool('search_memory'))).status, 403);
  assert.equal(
    (await postRpc(port, 'mem.test', `/mcp/claude/sse/int-weritas/messages/?session_id=${s.sid}`, T.ana, tool('search_memory'))).status,
    403, 'la ruta con otro namespace no engana',
  );
  assert.equal(backendSeen.filter((b) => b.url.includes('/messages/')).length, 1, 'solo llego lo permitido');
  s.close();
});

test('Mem0 enforce: lectura no escribe; admin hace de todo', async () => {
  const { port } = await gateway(true);
  const l = await openSse(port, 'mem.test', '/mcp/claude/sse/int-frutal', T.leo);
  const pl = `/mcp/messages/?session_id=${l.sid}`;
  assert.equal((await postRpc(port, 'mem.test', pl, T.leo, tool('search_memory'))).status, 202);
  assert.equal((await postRpc(port, 'mem.test', pl, T.leo, tool('add_memories', { text: 'x' }))).status, 403);
  l.close();
  const a = await openSse(port, 'mem.test', '/mcp/claude/sse/cualquier-cosa', T.adm);
  assert.equal(a.status, 200);
  assert.equal((await postRpc(port, 'mem.test', '/mcp/messages/?session_id=sin-sesion-0', T.adm, tool('delete_all_memories'))).status, 202);
  a.close();
});

test('Mem0 enforce: JSON invalido y cuerpos enormes se rechazan', async () => {
  const { port } = await gateway(true);
  const s = await openSse(port, 'mem.test', '/mcp/claude/sse/int-frutal', T.ana);
  const p = `/mcp/messages/?session_id=${s.sid}`;
  assert.equal((await postRaw(port, 'mem.test', p, T.ana, 'no es json')).status, 403);
  assert.equal((await postRpc(port, 'mem.test', p, T.ana, tool('add_memories', { text: 'x'.repeat(300 * 1024) }))).status, 413);
  s.close();
});

test('Basic Memory enforce: las cuatro fugas, a traves del gateway', async () => {
  const { port } = await gateway(true);
  const s = await openSse(port, 'kb.test', '/mcp', T.ana);
  backendSeen.length = 0;
  const p = `/messages/?session_id=${s.sid}`;
  const go = (name, args) => postRpc(port, 'kb.test', p, T.ana, tool(name, args));
  assert.equal((await go('read_note', { project: 'int-frutal', identifier: 'a' })).status, 202);
  assert.equal((await go('read_note', { identifier: 'memory://int-weritas/a' })).status, 403);
  assert.equal((await go('build_context', { project: 'int-frutal', url: 'memory://int-weritas/*' })).status, 403);
  assert.equal((await go('search_notes', { project: 'int-frutal', query: 'q', search_all_projects: true })).status, 403);
  assert.equal((await go('list_directory', { project_id: 'x', dir_name: '/' })).status, 403);
  assert.equal((await go('list_memory_projects', {})).status, 403);
  assert.equal(backendSeen.filter((b) => b.url.startsWith('/messages/')).length, 1, 'solo la llamada legitima llego a Basic Memory');
  s.close();
});

test('Basic Memory enforce: el cliente queda confinado a su espacio', async () => {
  const { port } = await gateway(true);
  const s = await openSse(port, 'kb.test', '/mcp', T.cli);
  const p = `/messages/?session_id=${s.sid}`;
  const go = (name, args) => postRpc(port, 'kb.test', p, T.cli, tool(name, args));
  assert.equal((await go('write_note', { project: 'cli-frutal', title: 't', content: 'c', directory: 'd' })).status, 202);
  assert.equal((await go('read_note', { project: 'int-frutal', identifier: 'a' })).status, 403);
  assert.equal((await go('read_note', { project: 'global', identifier: 'a' })).status, 403);
  s.close();
});

test('modo auditoria: no bloquea, pero registra lo que denegaria', async () => {
  const { port, logs } = await gateway(false);
  const s = await openSse(port, 'mem.test', '/mcp/claude/sse/int-weritas', T.ana); // ana no tiene int-weritas
  assert.equal(s.status, 200, 'en auditoria pasa');
  const d = await postRpc(port, 'mem.test', `/mcp/messages/?session_id=${s.sid}`, T.ana, tool('delete_all_memories'));
  assert.equal(d.status, 202);
  s.close();
  await new Promise((r) => setTimeout(r, 150)); // el registro de una conexion SSE se escribe al cerrarse
  assert.ok(logs.some((l) => l.dev === 'ana' && /^would_deny:sin_acceso_al_espacio/.test(l.pol || '')), 'queda registrado');
  assert.ok(logs.some((l) => l.m === 'POST' && /^would_deny:/.test(l.pol || '')), 'tambien el mensaje queda registrado');
});

test('cerrar las sesiones de una persona no toca las de otra', async () => {
  const { gw, port } = await gateway(true);
  const a = await openSse(port, 'mem.test', '/mcp/claude/sse/int-frutal', T.ana);
  const l = await openSse(port, 'mem.test', '/mcp/claude/sse/int-frutal', T.leo);
  assert.ok(gw.sessionCount() >= 2);
  const ended = new Promise((resolve) => { a.res.on('close', resolve); a.res.on('error', resolve); });
  assert.equal(gw.closeSessions('ana'), 1);
  await ended;
  assert.equal((await postRpc(port, 'mem.test', `/mcp/messages/?session_id=${l.sid}`, T.leo, tool('search_memory'))).status, 202);
  l.close();
});

test('limite de peticiones por persona', async () => {
  const { port } = await gateway(true, { rateLimitPerMin: 3 });
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await postRpc(port, 'mem.test', '/mcp/messages/?session_id=nada0000', T.ana, tool('search_memory'))).status);
  assert.deepEqual(codes.slice(3), [429, 429]);
});

test('las sesiones de un admin tambien se pueden cortar (baja o cambio de rol)', async () => {
  const { gw, port } = await gateway(true);
  const a = await openSse(port, 'kb.test', '/mcp', T.adm);
  const m = await openSse(port, 'mem.test', '/mcp/claude/sse/cualquier-cosa', T.adm);
  assert.equal(gw.sessionCount(), 2);
  const ended = [a, m].map((s) => new Promise((r) => { s.res.on('close', r); s.res.on('error', r); }));
  assert.equal(gw.closeSessions('adm'), 2);
  await Promise.all(ended);
});
