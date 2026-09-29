// node --test memory/access
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGateway, parseDevs, hashToken } from './server.mjs';

const TOKEN = 'omnia_test_token_ana_0123456789abcdef';
const seen = []; // lo que recibe el "backend"
let upstream, gateway, gwPort, upPort;

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

before(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, dev: req.headers['x-omnia-dev'], body });
      if (req.url.startsWith('/mcp/claude/sse/')) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('event: endpoint\ndata: /mcp/messages/?session_id=1\n\n');
        setTimeout(() => { res.write('event: late\ndata: 2\n\n'); res.end(); }, 400);
      } else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ echo: body }));
      }
    });
  });
  upPort = await listen(upstream);

  gateway = createGateway({
    devs: parseDevs(`ana:${hashToken(TOKEN)}`),
    routes: [
      { name: 'mem0', hosts: ['mem.test'], upstream: `http://127.0.0.1:${upPort}`, upstreamAuth: 'Bearer backend-secret', allow: ['/mcp/'] },
      { name: 'knowledge', hosts: ['kb.test'], upstream: `http://127.0.0.1:${upPort}`, upstreamAuth: 'Basic YmFja2VuZA==', allow: ['/'] },
    ],
  });
  gwPort = await listen(gateway);
});

after(() => { gateway.close(); upstream.close(); gateway.closeAllConnections?.(); upstream.closeAllConnections?.(); });

function call(host, path, { method = 'GET', token, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { host };
    if (token) headers.authorization = `Bearer ${token}`;
    const req = http.request({ port: gwPort, host: '127.0.0.1', path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('sin token o con token malo: 401 y nada llega al backend', async () => {
  seen.length = 0;
  assert.equal((await call('mem.test', '/mcp/claude/sse/p')).status, 401);
  assert.equal((await call('mem.test', '/mcp/claude/sse/p', { token: 'omnia_otro' })).status, 401);
  assert.equal((await call('kb.test', '/mcp', { token: 'omnia_otro' })).status, 401);
  assert.equal(seen.length, 0);
});

test('un mismo token abre las dos rutas y el backend recibe SU credencial, no el token del dev', async () => {
  seen.length = 0;
  const a = await call('mem.test', '/mcp/messages/?session_id=1', { method: 'POST', token: TOKEN, body: 'hola' });
  const b = await call('kb.test', '/mcp', { method: 'POST', token: TOKEN, body: 'nota' });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.deepEqual(seen.map((s) => s.auth), ['Bearer backend-secret', 'Basic YmFja2VuZA==']);
  assert.ok(seen.every((s) => s.dev === 'ana'));
  assert.deepEqual(seen.map((s) => s.body), ['hola', 'nota']);
  assert.ok(!JSON.stringify(seen).includes(TOKEN));
});

test('Mem0 solo expone /mcp/: el resto de OpenMemory da 404 y no llega al backend', async () => {
  seen.length = 0;
  for (const p of ['/api/v1/memories/', '/docs', '/mcp/../api/v1/apps', '/mcp/%2e%2e/api/v1/apps', '/mcp%2fx']) {
    assert.equal((await call('mem.test', p, { token: TOKEN })).status, 404, p);
  }
  assert.equal(seen.length, 0);
});

test('SSE: el primer evento llega antes de que el backend termine', async () => {
  const t0 = Date.now();
  const firstChunkMs = await new Promise((resolve, reject) => {
    const req = http.request({
      port: gwPort, host: '127.0.0.1', path: '/mcp/claude/sse/proyecto',
      headers: { host: 'mem.test', authorization: `Bearer ${TOKEN}` },
    }, (res) => {
      assert.equal(res.headers['content-type'], 'text/event-stream');
      res.once('data', () => { resolve(Date.now() - t0); req.destroy(); });
    });
    req.on('error', reject);
    req.end();
  });
  assert.ok(firstChunkMs < 300, `primer chunk tardo ${firstChunkMs}ms (buffering?)`);
});

test('/whoami identifica al dev; /healthz no pide token; host desconocido da 404', async () => {
  const w = await call('kb.test', '/whoami', { token: TOKEN });
  assert.deepEqual(JSON.parse(w.data), { dev: 'ana', route: 'knowledge' });
  assert.equal((await call('mem.test', '/healthz')).status, 200);
  assert.equal((await call('otro.test', '/mcp/x', { token: TOKEN })).status, 404);
});

test('revocar: sin la linea del dev, su token deja de servir en las dos rutas', async () => {
  const revoked = createGateway({
    devs: parseDevs(`luis:${hashToken('omnia_luis_token_0123456789abcdef')}`),
    routes: [{ name: 'mem0', hosts: ['mem.test'], upstream: `http://127.0.0.1:${upPort}`, allow: ['/mcp/'] }],
  });
  const port = await listen(revoked);
  const status = await new Promise((resolve) => {
    http.get({ port, host: '127.0.0.1', path: '/whoami', headers: { host: 'mem.test', authorization: `Bearer ${TOKEN}` } },
      (res) => { res.resume(); resolve(res.statusCode); });
  });
  revoked.close();
  assert.equal(status, 401);
});

test('ACCESS_DEVS mal formado falla al arrancar en vez de aceptar a nadie o a todos', () => {
  assert.throws(() => parseDevs('ana:noeshash'), /linea invalida/);
  assert.equal(parseDevs('').size, 0);
  assert.equal(parseDevs(`ana:${hashToken('a')}\n# comentario\nluis:${hashToken('b')}`).size, 2);
});
