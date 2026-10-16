import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGateway, hashToken } from './server.mjs';
import { allowedOriginsFromEnv } from './streamable.mjs';
import { createStore } from './users.mjs';
import { configureKbAliases, configureNamespaceAliases } from './policy.mjs';

const TOKENS = {
  member: 'omnia_member_token_0123456789abcdef',
  reader: 'omnia_reader_token_0123456789abcdef',
  client: 'omnia_client_token_0123456789abcdef',
  admin: 'omnia_admin_token_0123456789abcdef',
};
const envText = [
  `member:${hashToken(TOKENS.member)}:miembro:proy-vision-infra`,
  `reader:${hashToken(TOKENS.reader)}:lectura:proy-vision-infra`,
  `client:${hashToken(TOKENS.client)}:cliente:cli-frutal`,
].join(',');
const adminsText = `admin:${hashToken(TOKENS.admin)}`;
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

function shutdown(server) {
  return new Promise((resolve) => {
    if (!server.listening) return resolve();
    server.close(() => resolve());
    server.closeAllConnections?.();
  });
}

function writeEvent(session, event, data) {
  if (!session || session.res.destroyed || session.res.writableEnded) return;
  session.res.write(`event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

async function startBackend(options = {}) {
  const state = { requests: [], gets: [], posts: [], sessions: [] };
  let nextSession = 0;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const record = { method: req.method, url: req.url, headers: req.headers, body };
      state.requests.push(record);
      if (req.method === 'GET') {
        state.gets.push(record);
        if (options.getStatus && options.getStatus !== 200) {
          res.writeHead(options.getStatus, { 'content-type': 'text/plain' });
          res.end('no disponible');
          return;
        }
        const id = `s${++nextSession}`;
        const session = { id, req, res, record, posts: [], closed: false };
        state.sessions.push(session);
        res.on('close', () => { session.closed = true; });
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const endpoint = options.endpoint ?? `/messages/?session_id=${id}`;
        if (!options.omitEndpoint) writeEvent(session, 'endpoint', endpoint);
        if (options.closeAfterEndpoint) res.end();
        return;
      }

      const sessionId = new URL(req.url, 'http://backend').searchParams.get('session_id');
      const session = state.sessions.find((candidate) => candidate.id === sessionId);
      let message = null;
      try { message = JSON.parse(body); } catch {}
      const post = { ...record, message, sessionId };
      state.posts.push(post);
      if (session) session.posts.push(post);
      const status = options.postStatus || 202;
      res.writeHead(status);
      res.end();
      if (status < 200 || status >= 300 || options.silent || !message || !('id' in message)) return;

      const internalInit = String(message.id).startsWith('omnia-init-');
      if (options.handshakeError && internalInit) {
        writeEvent(session, 'message', { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: 'saludo rechazado' } });
        return;
      }
      if (options.distractors && !internalInit) {
        writeEvent(session, 'message', 'json roto');
        writeEvent(session, 'message', { jsonrpc: '2.0', method: 'notifications/message', params: { ruido: true } });
        writeEvent(session, 'message', { jsonrpc: '2.0', id: 'server-request', method: 'roots/list', params: {} });
        writeEvent(session, 'message', { jsonrpc: '2.0', id: String(message.id), result: { distractor: 'string' } });
        writeEvent(session, 'message', { jsonrpc: '2.0', id: 2, result: { distractor: 'otro id' } });
      }
      if (options.applicationError && !internalInit) {
        writeEvent(session, 'message', { jsonrpc: '2.0', id: message.id, error: { code: -32602, message: 'error de aplicacion' } });
      } else {
        writeEvent(session, 'message', { jsonrpc: '2.0', id: message.id, result: { method: message.method } });
      }
    });
  });
  const port = await listen(server);
  return { server, port, ...state };
}

async function setup(t, options = {}) {
  const backend = await startBackend(options.backend);
  const logs = [];
  const gateway = createGateway({
    store: createStore({ envText, adminsText }),
    routes: [
      { name: 'mem0', hosts: ['memory.test'], upstream: options.upstream || `http://127.0.0.1:${backend.port}`, upstreamAuth: 'Bearer backend-mem0', allow: ['/mcp/'] },
      { name: 'knowledge', hosts: ['kb.test'], upstream: options.upstream || `http://127.0.0.1:${backend.port}`, upstreamAuth: 'Basic backend-kb', allow: ['/'] },
    ],
    enforce: options.enforce ?? true,
    allowedOrigins: options.allowedOrigins || [],
    aliasEnv: options.aliasEnv || '',
    kbAliasEnv: options.kbAliasEnv || '',
    rateLimitPerMin: options.rateLimitPerMin || 1200,
    log: (entry) => logs.push(entry),
  });
  const port = await listen(gateway);
  t.after(async () => {
    configureNamespaceAliases('');
    configureKbAliases('');
    await Promise.all([shutdown(gateway), shutdown(backend.server)]);
  });
  return { backend, gateway, logs, port };
}

function rpc(id = 1, method = 'tools/list') {
  return { jsonrpc: '2.0', id, method };
}

function tool(name, args = {}, id = 1) {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } };
}

function call(port, host, path, options = {}) {
  const method = options.method || 'POST';
  const body = options.body !== undefined ? options.body : method === 'POST' ? JSON.stringify(rpc()) : undefined;
  const token = options.token === undefined ? TOKENS.member : options.token;
  const contentType = options.contentType === undefined ? body === undefined ? null : 'application/json' : options.contentType;
  return new Promise((resolve, reject) => {
    const headers = { host, ...(options.headers || {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) {
      if (contentType) headers['content-type'] = contentType;
      headers['content-length'] = String(Buffer.byteLength(body));
    }
    const req = http.request({ port, host: '127.0.0.1', path, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        if (data) {
          try { json = JSON.parse(data); } catch {}
        }
        resolve({ status: res.statusCode, headers: res.headers, data, json });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

const post = (port, host, path, message, options = {}) => call(port, host, path, {
  ...options, method: 'POST', body: JSON.stringify(message),
});

async function waitFor(predicate, message) {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message);
}

test('el allowlist de origenes descarta entradas invalidas sin fallar', () => {
  const warnings = [];
  const origins = allowedOriginsFromEnv(
    ' HTTPS://APP.EXAMPLE ,http://localhost:3000,https://bad.example/path,*,null,no-es-url,https://port.example:443',
    (warning) => warnings.push(warning),
  );
  assert.deepEqual(origins, ['https://app.example', 'http://localhost:3000']);
  assert.equal(warnings.length, 5);
  assert.ok(warnings.every((warning) => warning.startsWith('AVISO:')));
});

test('Mem0 responde con el mismo id y solo envia credenciales upstream', async (t) => {
  const { backend, gateway, port } = await setup(t);
  const message = tool('search_memory', { query: 'arquitectura' }, 7);
  const response = await post(port, 'memory.test', '/mcp/proy-vision-infra', message, {
    headers: { cookie: 'privada=1', 'mcp-session-id': 'no-reenviar' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'application/json');
  assert.equal(response.json.id, 7);
  assert.equal(response.headers['mcp-session-id'], undefined);
  assert.equal(backend.gets[0].url, '/mcp/streamable/sse/proy-vision-infra');
  assert.equal(backend.gets[0].headers.authorization, 'Bearer backend-mem0');
  assert.equal(backend.gets[0].headers['x-omnia-dev'], 'member');
  assert.equal(backend.gets[0].headers.cookie, undefined);
  assert.equal(backend.gets[0].headers['mcp-session-id'], undefined);
  assert.ok(!JSON.stringify(backend.requests).includes(TOKENS.member));
  assert.deepEqual(backend.posts.map((entry) => entry.message.method), ['initialize', 'notifications/initialized', 'tools/call']);
  assert.match(backend.posts[0].message.id, /^omnia-init-[0-9a-f]{16}$/);
  assert.deepEqual(backend.posts[2].message, message);
  assert.equal(gateway.sessionCount(), 0);
  await waitFor(() => backend.sessions[0].closed, 'el SSE upstream no se cerro');
});

test('KB usa su SSE y reenvia el mensaje del cliente sin cambios', async (t) => {
  const { backend, port } = await setup(t);
  const message = tool('read_note', { project: 'proy-vision-infra', identifier: 'guias/arquitectura' }, 'kb-1');
  const response = await post(port, 'kb.test', '/mcp', message);

  assert.equal(response.status, 200);
  assert.equal(response.json.id, 'kb-1');
  assert.equal(backend.gets[0].url, '/mcp');
  assert.equal(backend.gets[0].headers.authorization, 'Basic backend-kb');
  assert.deepEqual(backend.posts[2].message, message);
  assert.ok(!JSON.stringify(backend.requests).includes(TOKENS.member));
});

test('el puente descarta distractores y correlaciona ids por tipo y valor', async (t) => {
  const { backend, port } = await setup(t, { backend: { distractors: true } });
  const response = await post(port, 'memory.test', '/mcp/proy-vision-infra', rpc(1));

  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { jsonrpc: '2.0', id: 1, result: { method: 'tools/list' } });
  assert.equal(backend.posts.length, 3);
});

test('initialize del cliente es el unico saludo y un error JSON-RPC sigue siendo 200', async (t) => {
  const first = await setup(t, { backend: { applicationError: true } });
  const message = {
    jsonrpc: '2.0', id: 'init-cliente', method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: { roots: {} }, clientInfo: { name: 'cliente', version: '2' } },
  };
  const response = await post(first.port, 'memory.test', '/mcp/proy-vision-infra', message);

  assert.equal(response.status, 200);
  assert.equal(response.json.error.code, -32602);
  assert.equal(first.backend.posts.length, 1);
  assert.deepEqual(first.backend.posts[0].message, message);
});

test('las notificaciones validas devuelven 202 sin upstream y las denegadas devuelven 403', async (t) => {
  const { backend, port } = await setup(t);
  const accepted = await post(port, 'memory.test', '/mcp/proy-vision-infra', { jsonrpc: '2.0', method: 'notifications/initialized' });
  const deniedMessage = tool('add_memories', { text: 'no permitido' });
  delete deniedMessage.id;
  const denied = await post(port, 'memory.test', '/mcp/proy-vision-infra', deniedMessage, { token: TOKENS.reader });

  assert.equal(accepted.status, 202);
  assert.equal(accepted.data, '');
  assert.equal(denied.status, 403);
  assert.deepEqual(denied.json, { error: 'forbidden', reason: 'solo_lectura' });
  assert.equal(backend.requests.length, 0);
});

test('batch, JSON-RPC invalido, content type y tamano se rechazan antes del upstream', async (t) => {
  const { backend, port } = await setup(t);
  const path = '/mcp/proy-vision-infra';
  for (const batch of [[], [rpc()], [rpc(1), rpc(2)], Array.from({ length: 50 }, (_, i) => rpc(i))]) {
    const response = await post(port, 'memory.test', path, batch, { token: TOKENS.admin });
    assert.equal(response.status, 400);
    assert.deepEqual(response.json, { error: 'invalid_rpc', reason: 'batch_no_soportado' });
  }

  const invalid = await call(port, 'memory.test', path, { body: '{roto' });
  assert.deepEqual(invalid.json, { error: 'invalid_json' });
  const cases = [
    [null, 'mensaje_invalido'],
    [{ jsonrpc: '1.0', id: 1, method: 'ping' }, 'mensaje_invalido'],
    [{ jsonrpc: '2.0', id: 1, result: {} }, 'respuesta_no_soportada'],
    [{ jsonrpc: '2.0', id: null, method: 'ping' }, 'id_invalido'],
    [{ jsonrpc: '2.0', id: 'omnia-init-cliente', method: 'ping' }, 'id_reservado'],
    [{ jsonrpc: '2.0', id: 1, method: '' }, 'mensaje_invalido'],
    [{ jsonrpc: '2.0', id: 1, method: 'ping', params: 5 }, 'mensaje_invalido'],
    [{ jsonrpc: '2.0', id: 1, method: 'ping', params: 'x' }, 'mensaje_invalido'],
    [{ jsonrpc: '2.0', id: 1, method: 'ping', params: null }, 'mensaje_invalido'],
  ];
  for (const [message, reason] of cases) {
    const response = await post(port, 'memory.test', path, message);
    assert.equal(response.status, 400, reason);
    assert.deepEqual(response.json, { error: 'invalid_rpc', reason });
  }

  const media = await call(port, 'memory.test', path, { contentType: 'text/plain' });
  assert.equal(media.status, 415);
  assert.deepEqual(media.json, { error: 'unsupported_media_type' });
  const large = await call(port, 'memory.test', path, { body: 'x'.repeat(256 * 1024 + 1) });
  assert.equal(large.status, 413);
  assert.deepEqual(large.json, { error: 'cuerpo_demasiado_grande' });
  assert.equal(backend.requests.length, 0);
});

test('POST autentica antes de denegar Origin y aplica CORS a todas las respuestas', async (t) => {
  const { backend, port } = await setup(t, { allowedOrigins: ['https://app.example'] });
  const path = '/mcp/proy-vision-infra';
  const anonymous = await call(port, 'memory.test', path, { token: null, headers: { origin: 'https://evil.example' } });
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers['www-authenticate'], 'Bearer');
  assert.equal(anonymous.headers['access-control-allow-origin'], undefined);
  assert.equal(anonymous.headers.vary, 'Origin');

  const evil = await call(port, 'memory.test', path, { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  assert.deepEqual(evil.json, { error: 'forbidden', reason: 'origin_no_permitido' });
  assert.equal(evil.headers['access-control-allow-origin'], undefined);
  assert.equal(backend.requests.length, 0);

  const unauthorized = await call(port, 'memory.test', path, { token: null, headers: { origin: 'HTTPS://APP.EXAMPLE' } });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers['access-control-allow-origin'], 'https://app.example');
  assert.equal(unauthorized.headers['access-control-expose-headers'], 'WWW-Authenticate, Retry-After');

  const allowed = await call(port, 'memory.test', path, { headers: { origin: 'https://app.example' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example');
  assert.equal(allowed.headers['access-control-allow-credentials'], undefined);
  const withoutOrigin = await call(port, 'memory.test', path);
  assert.equal(withoutOrigin.status, 200);
  assert.equal(withoutOrigin.headers.vary, 'Origin');
  assert.equal(withoutOrigin.headers['access-control-allow-origin'], undefined);

  const nullOrigin = await call(port, 'memory.test', path, { headers: { origin: 'null' } });
  assert.equal(nullOrigin.status, 403);
});

test('un allowlist vacio rechaza cualquier Origin tras autenticar', async (t) => {
  const { backend, port } = await setup(t);
  const response = await call(port, 'kb.test', '/mcp', { headers: { origin: 'https://app.example' } });
  assert.equal(response.status, 403);
  assert.equal(response.json.reason, 'origin_no_permitido');
  assert.equal(backend.requests.length, 0);
});

test('preflight no exige auth ni consume rate limit', async (t) => {
  const { backend, port } = await setup(t, { allowedOrigins: ['https://app.example'], rateLimitPerMin: 1 });
  const allowed = await call(port, 'memory.test', '/mcp/proy-vision-infra', {
    method: 'OPTIONS', token: null, headers: { origin: 'https://app.example' },
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.data, '');
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example');
  assert.equal(allowed.headers['access-control-allow-methods'], 'POST, OPTIONS');
  assert.equal(allowed.headers['access-control-allow-headers'], 'authorization, content-type, accept, mcp-protocol-version');
  assert.equal(allowed.headers['access-control-max-age'], '600');
  assert.equal(allowed.headers.vary, 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');

  const denied = await call(port, 'kb.test', '/mcp', { method: 'OPTIONS', token: null, headers: { origin: 'null' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
  const anonymous = await call(port, 'kb.test', '/mcp', { method: 'OPTIONS', token: null });
  assert.equal(anonymous.status, 204);
  assert.equal(anonymous.headers.allow, 'POST, OPTIONS');
  assert.equal(anonymous.headers.vary, 'Origin');
  assert.equal(anonymous.headers['access-control-allow-origin'], undefined);
  const subpath = await call(port, 'kb.test', '/mcp/x', { method: 'OPTIONS', token: null });
  assert.equal(subpath.status, 404);
  assert.equal(backend.requests.length, 0);

  const afterPreflights = await post(port, 'memory.test', '/mcp/proy-vision-infra', rpc());
  assert.equal(afterPreflights.status, 200);
});

test('rutas cruzadas y metodos no soportados nunca llegan upstream', async (t) => {
  const enforcing = await setup(t);
  let response = await post(enforcing.port, 'memory.test', '/mcp', rpc());
  assert.equal(response.status, 403);
  assert.equal(response.json.reason, 'ruta_no_permitida');
  response = await post(enforcing.port, 'memory.test', '/mcp', rpc(), { token: TOKENS.admin });
  assert.equal(response.status, 404);
  for (const token of [TOKENS.member, TOKENS.admin]) {
    response = await post(enforcing.port, 'kb.test', '/mcp/proy-vision-infra', rpc(), { token });
    assert.equal(response.status, 404);
  }
  for (const [host, path, method, status] of [
    ['memory.test', '/mcp/proy-vision-infra', 'GET', 405],
    ['memory.test', '/mcp/proy-vision-infra', 'DELETE', 405],
    ['kb.test', '/mcp', 'DELETE', 405],
    ['kb.test', '/mcp/x', 'GET', 404],
  ]) {
    response = await call(enforcing.port, host, path, { method });
    assert.equal(response.status, status, `${method} ${path}`);
    if (status === 405) assert.equal(response.headers.allow, 'POST, OPTIONS');
  }
  assert.equal(enforcing.backend.requests.length, 0);

  const auditing = await setup(t, { enforce: false });
  response = await post(auditing.port, 'memory.test', '/mcp', rpc());
  assert.equal(response.status, 404);
  response = await post(auditing.port, 'kb.test', '/mcp/proy-vision-infra', rpc(), { token: TOKENS.admin });
  assert.equal(response.status, 404);
  assert.equal(auditing.backend.requests.length, 0);
});

test('las politicas Mem0 y KB se aplican por request', async (t) => {
  const { backend, port } = await setup(t);
  let response = await post(port, 'memory.test', '/mcp/int-weritas', rpc());
  assert.equal(response.status, 403);
  assert.equal(response.json.reason, 'sin_acceso_al_espacio');
  response = await post(port, 'memory.test', '/mcp/proy-vision-infra', tool('add_memories', { text: 'escritura' }), { token: TOKENS.reader });
  assert.equal(response.status, 403);
  assert.equal(response.json.reason, 'solo_lectura');
  response = await post(port, 'kb.test', '/mcp', tool('read_note', { project: 'int-weritas', identifier: 'x' }));
  assert.equal(response.status, 403);
  assert.equal(response.json.reason, 'sin_acceso_al_espacio');

  const forbidden = [
    [{ project: 'proy-vision-infra', project_id: 'x' }, 'argumento_prohibido:project_id'],
    [{ project: 'proy-vision-infra', workspace: 'x' }, 'argumento_prohibido:workspace'],
    [{ project: 'proy-vision-infra', search_all_projects: true }, 'argumento_prohibido:search_all_projects'],
    [{ project: 'proy-vision-infra', identifier: 'memory://int-weritas/x' }, 'url_memory_de_otro_proyecto'],
  ];
  for (const [args, reason] of forbidden) {
    response = await post(port, 'kb.test', '/mcp', tool('read_note', args));
    assert.equal(response.status, 403, reason);
    assert.equal(response.json.reason, reason);
  }
  assert.equal(backend.requests.length, 0);
});

test('auditoria registra solo la primera denegacion y continua al upstream', async (t) => {
  const { backend, logs, port } = await setup(t, { enforce: false });
  const response = await post(port, 'memory.test', '/mcp/int-weritas', tool('herramienta_desconocida'));

  assert.equal(response.status, 200);
  assert.equal(backend.gets.length, 1);
  await waitFor(() => logs.some((entry) => entry.p === '/mcp/int-weritas'), 'no se registro la request');
  const entries = logs.filter((entry) => entry.m === 'POST' && entry.p === '/mcp/int-weritas');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].pol, 'would_deny:sin_acceso_al_espacio');
  assert.ok(!logs.some((entry) => String(entry.pol).includes('herramienta_no_permitida')));
});

test('admin recorre validacion y politica sin bypass del adaptador', async (t) => {
  const { backend, port } = await setup(t);
  let response = await post(port, 'memory.test', '/mcp/proy-vision-infra', tool('no_existe'), { token: TOKENS.admin });
  assert.equal(response.status, 403);
  assert.equal(response.json.reason, 'herramienta_no_permitida:no_existe');
  assert.equal(backend.requests.length, 0);

  response = await post(port, 'memory.test', '/mcp/proy-vision-infra', tool('delete_all_memories'), { token: TOKENS.admin });
  assert.equal(response.status, 200);
  response = await post(port, 'kb.test', '/mcp', tool('cualquier_herramienta', { project: 'otro', project_id: 'admin' }), { token: TOKENS.admin });
  assert.equal(response.status, 200);
  response = await call(port, 'memory.test', '/mcp/proy-vision-infra', { token: TOKENS.admin, body: 'no json' });
  assert.equal(response.status, 400);
  assert.deepEqual(response.json, { error: 'invalid_json' });
});

test('GET, POST y cierre SSE defectuosos devuelven 502 sin filtrar datos internos', async (t) => {
  const getFailure = await setup(t, { backend: { getStatus: 500 } });
  let response = await post(getFailure.port, 'memory.test', '/mcp/proy-vision-infra', rpc());
  assert.equal(response.status, 502);
  assert.deepEqual(response.json, { error: 'upstream_unreachable' });
  assert.equal(getFailure.backend.posts.length, 0);

  const postFailure = await setup(t, { backend: { postStatus: 500 } });
  response = await post(postFailure.port, 'memory.test', '/mcp/proy-vision-infra', rpc());
  assert.equal(response.status, 502);
  assert.deepEqual(response.json, { error: 'upstream_unreachable' });

  const closed = await setup(t, { backend: { closeAfterEndpoint: true } });
  response = await post(closed.port, 'memory.test', '/mcp/proy-vision-infra', rpc());
  assert.equal(response.status, 502);
  assert.deepEqual(response.json, { error: 'upstream_unreachable' });
  for (const result of [response.json]) {
    assert.ok(!JSON.stringify(result).includes('127.0.0.1'));
    assert.ok(!JSON.stringify(result).includes('backend-mem0'));
    assert.ok(!JSON.stringify(result).includes(TOKENS.member));
  }
});

test('un error en el saludo interno tiene su error estable', async (t) => {
  const { backend, port } = await setup(t, { backend: { handshakeError: true } });
  const response = await post(port, 'memory.test', '/mcp/proy-vision-infra', rpc());
  assert.equal(response.status, 502);
  assert.deepEqual(response.json, { error: 'upstream_handshake_failed' });
  assert.equal(backend.posts.length, 1);
  assert.match(backend.posts[0].message.id, /^omnia-init-/);
});

test('un endpoint de otro origen se rechaza sin hacer POST hacia el', async (t) => {
  let crossPosts = 0;
  const cross = http.createServer((req, res) => {
    crossPosts++;
    res.writeHead(202);
    res.end();
  });
  const crossPort = await listen(cross);
  t.after(() => shutdown(cross));
  const { backend, port } = await setup(t, { backend: { endpoint: `http://127.0.0.1:${crossPort}/messages` } });
  const response = await post(port, 'memory.test', '/mcp/proy-vision-infra', rpc());

  assert.equal(response.status, 502);
  assert.deepEqual(response.json, { error: 'upstream_unreachable' });
  assert.equal(crossPosts, 0);
  assert.equal(backend.posts.length, 0);
});

test('una conexion rechazada devuelve 502 sin la URL interna', async (t) => {
  const unused = http.createServer();
  const unusedPort = await listen(unused);
  await shutdown(unused);
  const upstream = `http://127.0.0.1:${unusedPort}`;
  const { port } = await setup(t, { upstream });
  const response = await post(port, 'memory.test', '/mcp/proy-vision-infra', rpc());

  assert.equal(response.status, 502);
  assert.deepEqual(response.json, { error: 'upstream_unreachable' });
  assert.ok(!response.data.includes(upstream));
});

test('el plazo total devuelve 504 y cierra la sesion upstream', async (t) => {
  const previous = process.env.ACCESS_STREAMABLE_TIMEOUT_MS;
  process.env.ACCESS_STREAMABLE_TIMEOUT_MS = '80';
  t.after(() => {
    if (previous === undefined) delete process.env.ACCESS_STREAMABLE_TIMEOUT_MS;
    else process.env.ACCESS_STREAMABLE_TIMEOUT_MS = previous;
  });
  const { backend, port } = await setup(t, { backend: { silent: true } });
  const response = await post(port, 'memory.test', '/mcp/proy-vision-infra', rpc());

  assert.equal(response.status, 504);
  assert.deepEqual(response.json, { error: 'upstream_timeout' });
  await waitFor(() => backend.sessions[0]?.closed, 'el SSE no se cerro tras el timeout');
});

test('params ausente es valido y cada request abre una sesion canonica independiente', async (t) => {
  const { backend, gateway, port } = await setup(t, { aliasEnv: 'vision-infra=proy-vision-infra' });
  for (const method of ['initialize', 'ping', 'tools/list']) {
    const response = await post(port, 'memory.test', '/mcp/proy-vision-infra', rpc(method === 'ping' ? 'abc' : 1, method));
    assert.equal(response.status, 200, method);
  }
  const alias = await post(port, 'memory.test', '/mcp/vision-infra', rpc('alias'));
  assert.equal(alias.status, 200);
  assert.equal(alias.json.id, 'alias');

  assert.equal(backend.gets.length, 4);
  assert.ok(backend.gets.every((entry) => entry.url === '/mcp/streamable/sse/vision-infra'));
  assert.equal(new Set(backend.sessions.map((session) => session.id)).size, 4);
  assert.equal(gateway.sessionCount(), 0);
  await waitFor(() => backend.sessions.every((session) => session.closed), 'quedaron sesiones upstream abiertas');
});
