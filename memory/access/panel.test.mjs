// node --test memory/access
// Panel de administracion: altas y bajas sin redeploy, a traves del gateway completo.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';

const ADM = 'omnia_adm_token_0123456789abcdef';
const ENVU = 'omnia_env_token_0123456789abcdef';
const MEM = 'omnia_mem_token_0123456789abcdef';
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-panel-'));
// Un build de mentira del portal; `secreto.txt` queda FUERA de la carpeta publica.
const panelDir = path.join(dir, 'panel');
mkdirSync(path.join(panelDir, 'assets'), { recursive: true });
writeFileSync(path.join(panelDir, 'index.html'), '<!doctype html><meta name="csp-nonce" content="__CSP_NONCE__"><div id="root"></div>');
writeFileSync(path.join(panelDir, 'assets', 'index-abc123.js'), 'console.log(1)');
writeFileSync(path.join(panelDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
writeFileSync(path.join(dir, 'secreto.txt'), 'no se sirve');

let upstream, upPort, gw, port, logs;
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

before(async () => {
  upstream = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(`event: endpoint\r\ndata: /messages/?session_id=sess${Math.random().toString(16).slice(2, 12).padEnd(10, '0')}\r\n\r\n`);
        return;
      }
      res.writeHead(202); res.end('ok');
    });
  });
  upPort = await listen(upstream);
  logs = [];
  gw = createGateway({
    store: createStore({
      envText: `envuser:${hashToken(ENVU)}:miembro:int-frutal,mem:${hashToken(MEM)}:miembro:int-frutal`,
      adminsText: `adm:${hashToken(ADM)}`,
      file: path.join(dir, 'users.json'),
    }),
    routes: [
      { name: 'mem0', hosts: ['mem.test'], upstream: `http://127.0.0.1:${upPort}`, allow: ['/mcp/'] },
      { name: 'knowledge', hosts: ['kb.test'], upstream: `http://127.0.0.1:${upPort}`, allow: ['/'] },
      { name: 'panel', hosts: ['panel.test'], upstream: '', allow: [] },
    ],
    panelDir, enforce: true, failedAuthPerMin: 10, log: (e) => logs.push(e),
  });
  port = await listen(gw);
});
after(() => { gw.closeAllConnections?.(); gw.close(); upstream.closeAllConnections?.(); upstream.close(); });

function call(host, method, p, token, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const headers = { host };
    if (token) headers.authorization = `Bearer ${token}`;
    if (data) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(data); }
    const req = http.request({ port, host: '127.0.0.1', path: p, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch { /* texto */ } resolve({ status: res.statusCode, body: j, text: d, headers: res.headers }); });
    });
    req.on('error', reject);
    req.end(data);
  });
}
const panel = (m, p, t, b) => call('panel.test', m, p, t, b);

test('el portal es publico, con cabeceras estrictas y nonce propio por respuesta', async () => {
  const r = await panel('GET', '/', null);
  assert.equal(r.status, 200);
  const csp = r.headers['content-security-policy'];
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /font-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  const nonce = /'nonce-([^']+)'/.exec(csp)[1];
  assert.ok(r.text.includes(`content="${nonce}"`), 'el nonce de la cabecera es el de la pagina');
  assert.ok(!r.text.includes('__CSP_NONCE__'));
  const again = await panel('GET', '/', null);
  assert.notEqual(/'nonce-([^']+)'/.exec(again.headers['content-security-policy'])[1], nonce, 'cambia en cada respuesta');
  assert.equal(r.headers['x-frame-options'], 'DENY');
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('las rutas de la app caen en la pagina de entrada y los assets se sirven con cache', async () => {
  const route = await panel('GET', '/people', null);
  assert.equal(route.status, 200);
  assert.match(route.headers['content-type'], /text\/html/);
  const js = await panel('GET', '/assets/index-abc123.js', null);
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
  assert.match(js.headers['cache-control'], /immutable/);
  assert.equal((await panel('GET', '/favicon.svg', null)).status, 200);
  assert.equal((await panel('GET', '/assets/no-existe.js', null)).status, 404);
});

test('el portal no sirve nada fuera de su carpeta', async () => {
  for (const p of ['/../secreto.txt', '/%2e%2e/secreto.txt', '/assets/..%2f..%2fsecreto.txt', '/..%2fsecreto.txt', '/policy.mjs', '/server.mjs', '/users.json', '/assets/%00.js']) {
    const r = await panel('GET', p, null);
    assert.ok(!/no se sirve/.test(r.text), `${p} no debe filtrar el archivo`);
    assert.ok(r.status === 404 || /text\/html/.test(r.headers['content-type']), `${p} -> ${r.status}`);
  }
  assert.equal((await panel('GET', '/policy.mjs', ADM)).status, 404);
});

test('la API exige token y el rol correcto', async () => {
  assert.equal((await panel('GET', '/api/me', null)).status, 401);
  assert.equal((await panel('GET', '/api/me', 'omnia_falso')).status, 401);
  const me = await panel('GET', '/api/me', ENVU);
  assert.deepEqual(me.body, { id: 'envuser', role: 'miembro', spaces: ['int-frutal'], via: 'bearer', portal: false });
  assert.equal((await panel('GET', '/api/admin/users', ENVU)).status, 403, 'un miembro no administra');
  assert.equal((await panel('POST', '/api/admin/users', ENVU, { id: 'x', role: 'admin' })).status, 403);
});

let newToken;
test('ALTA: la persona nueva funciona AL INSTANTE, sin redeploy ni reinicio', async () => {
  const bad = await panel('POST', '/api/admin/users', ADM, { id: 'ana', role: 'cliente', spaces: ['int-frutal'] });
  assert.equal(bad.status, 400, 'un cliente no puede tener espacios internos');
  const r = await panel('POST', '/api/admin/users', ADM, { id: 'ana', role: 'miembro', spaces: ['int-frutal'] });
  assert.equal(r.status, 201);
  newToken = r.body.token;
  assert.match(newToken, /^omnia_[A-Za-z0-9_-]{40,}$/);
  assert.match(r.body.commands.windows, /OMNIA_TOKEN='omnia_/);
  assert.equal(JSON.stringify(r.body).includes(hashToken(newToken)), false, 'no devuelve el hash');
  // el mismo token ya entra, en las dos memorias, sin tocar el servidor
  assert.deepEqual((await call('mem.test', 'GET', '/whoami', newToken)).body, { dev: 'ana', route: 'mem0', role: 'miembro' });
  assert.equal((await call('kb.test', 'GET', '/whoami', newToken)).body.dev, 'ana');
  assert.equal((await panel('POST', '/api/admin/users', ADM, { id: 'ana', role: 'lectura' })).status, 409, 'no se duplica');
  assert.equal((await panel('POST', '/api/admin/users', ADM, { id: 'envuser', role: 'lectura' })).status, 409, 'ni pisa a una de Coolify');
});

test('LISTA: nunca expone hashes ni tokens, y marca que es editable', async () => {
  const r = await panel('GET', '/api/admin/users', ADM);
  assert.equal(r.status, 200);
  assert.equal(/hash|omnia_[A-Za-z0-9_-]{30,}/.test(r.text), false);
  const by = Object.fromEntries(r.body.users.map((u) => [u.id, u]));
  assert.equal(by.ana.editable, true);
  assert.equal(by.envuser.editable, false);
  assert.equal(by.adm.editable, false);
});

test('CAMBIO: nuevos permisos y se corta la sesion abierta de esa persona', async () => {
  // ana abre una sesion SSE
  const sse = await new Promise((resolve, reject) => {
    const req = http.request({ port, host: '127.0.0.1', path: '/mcp/claude/sse/int-frutal', headers: { host: 'mem.test', authorization: `Bearer ${newToken}`, accept: 'text/event-stream' } }, (res) => {
      res.once('data', () => resolve({ res, req }));
    });
    req.on('error', reject);
    req.end();
  });
  const cerrada = new Promise((r) => { sse.res.on('close', r); sse.res.on('error', r); });
  const r = await panel('PATCH', '/api/admin/users/ana', ADM, { role: 'lectura', spaces: ['int-frutal', 'proy-omniapos'] });
  assert.equal(r.status, 200);
  assert.equal(r.body.sesiones_cerradas, 1);
  await cerrada;
  assert.equal((await call('mem.test', 'GET', '/whoami', newToken)).body.role, 'lectura');
  assert.equal((await panel('PATCH', '/api/admin/users/ana', ADM, { role: 'dios' })).status, 400);
  assert.equal((await panel('PATCH', '/api/admin/users/envuser', ADM, { role: 'lectura' })).status, 409);
});

test('ROTAR: el token anterior deja de servir y el nuevo sirve', async () => {
  const r = await panel('POST', '/api/admin/users/ana/rotate', ADM);
  assert.equal(r.status, 200);
  assert.equal((await call('mem.test', 'GET', '/whoami', newToken)).status, 401);
  assert.equal((await call('mem.test', 'GET', '/whoami', r.body.token)).body.dev, 'ana');
  newToken = r.body.token;
});

test('BAJA: inmediata en las dos memorias; y protecciones contra dejarte fuera', async () => {
  assert.equal((await panel('DELETE', '/api/admin/users/adm', ADM)).status, 409, 'el admin de emergencia no se gestiona aqui');
  const r = await panel('DELETE', '/api/admin/users/ana', ADM);
  assert.equal(r.status, 200);
  assert.equal((await call('mem.test', 'GET', '/whoami', newToken)).status, 401);
  assert.equal((await call('kb.test', 'GET', '/whoami', newToken)).status, 401);
  assert.equal((await panel('DELETE', '/api/admin/users/ana', ADM)).status, 404);
});

test('un admin del archivo no puede quitarse el rol ni darse de baja', async () => {
  const r = await panel('POST', '/api/admin/users', ADM, { id: 'jefe', role: 'admin' });
  const JEFE = r.body.token;
  assert.equal((await panel('DELETE', '/api/admin/users/jefe', JEFE)).status, 409);
  assert.equal((await panel('PATCH', '/api/admin/users/jefe', JEFE, { role: 'miembro' })).status, 409);
  assert.equal((await panel('PATCH', '/api/admin/users/jefe', JEFE, { spaces: [] })).status, 200);
});

test('cuerpos invalidos y enormes se rechazan', async () => {
  assert.equal((await panel('POST', '/api/admin/users', ADM, { id: 'Mala Id', role: 'miembro' })).status, 400);
  assert.equal((await panel('POST', '/api/admin/users', ADM, { id: 'x', role: 'miembro', spaces: ['global'] })).status, 400);
  const big = await panel('POST', '/api/admin/users', ADM, { id: 'x', role: 'miembro', pad: 'x'.repeat(20000) });
  assert.equal(big.status, 413);
  assert.equal((await panel('DELETE', '/api/admin/users/%00', ADM)).status, 400);
});

test('queda registro de auditoria de cada accion administrativa, sin tokens', () => {
  const acts = logs.filter((l) => l.ev === 'admin_action');
  for (const a of ['alta', 'cambio', 'rotar_token', 'baja', 'denegado']) assert.ok(acts.some((l) => l.action === a), a);
  assert.equal(JSON.stringify(logs).includes(newToken), false);
  assert.equal(acts.every((l) => l.by), true);
});

test('muchos tokens invalidos se frenan por origen, pero un token valido NUNCA se bloquea', async () => {
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await panel('GET', '/api/me', `omnia_mal_${i}`)).status);
  assert.ok(codes.includes(429), `esperaba un 429 en ${codes}`);
  const ok = await panel('GET', '/api/me', ADM);
  assert.equal(ok.status, 200, 'el admin sigue entrando aunque su IP acumule fallos de otros');
  assert.equal((await call('mem.test', 'GET', '/whoami', MEM)).status, 200);
});
