import { randomBytes } from 'node:crypto';
import {
  canonicalMem0Namespace, checkKbRpc, checkMem0Connect, checkMem0Rpc, parseRpc, spaceFromMem0,
} from './policy.mjs';

const BODY_LIMIT = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 20000;
const ALLOW = 'POST, OPTIONS';

export function allowedOriginsFromEnv(value, warn = (message) => console.error(message)) {
  const origins = [];
  for (const raw of String(value || '').split(',')) {
    const origin = raw.trim().toLowerCase();
    if (!origin) continue;
    try {
      if (origin === '*' || origin === 'null' || new URL(origin).origin !== origin) throw new Error('origen_invalido');
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      warn(`AVISO: origen no valido en ACCESS_ALLOWED_ORIGINS; se descarta: ${origin.slice(0, 120)}`);
    }
  }
  return origins;
}

function targetOf(route, pathname) {
  if (route.name === 'mem0') {
    const match = /^\/mcp\/([a-z0-9][a-z0-9_-]{0,31})$/.exec(pathname);
    if (match && match[1] !== 'messages') return { kind: 'mem0', segment: match[1] };
    return null;
  }
  if (route.name === 'knowledge') {
    if (pathname === '/mcp') return { kind: 'knowledge' };
    if (/^\/mcp\/.+/.test(pathname)) return { kind: 'knowledge-subpath' };
  }
  return null;
}

function originAllowed(req, allowedOrigins) {
  const origin = req.headers.origin;
  return typeof origin === 'string' && allowedOrigins.includes(origin.toLowerCase());
}

function sendJson(res, status, body) {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendEmpty(res, status) {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status);
  res.end();
}

export function streamableBeforeAuth({ req, res, route, pathname, allowedOrigins = [] }) {
  const target = targetOf(route, pathname);
  if (!target) return false;

  if (req.method === 'OPTIONS') {
    if (target.kind === 'knowledge-subpath') {
      res.setHeader('vary', 'Origin');
      sendJson(res, 404, { error: 'not_found' });
      return true;
    }
    if (req.headers.origin === undefined) {
      res.setHeader('vary', 'Origin');
      res.setHeader('allow', ALLOW);
      sendEmpty(res, 204);
      return true;
    }
    if (!originAllowed(req, allowedOrigins)) {
      res.setHeader('vary', 'Origin');
      sendJson(res, 403, { error: 'forbidden', reason: 'origin_no_permitido' });
      return true;
    }
    res.setHeader('access-control-allow-origin', req.headers.origin.toLowerCase());
    res.setHeader('access-control-allow-methods', ALLOW);
    res.setHeader('access-control-allow-headers', 'authorization, content-type, accept, mcp-protocol-version');
    res.setHeader('access-control-max-age', '600');
    res.setHeader('vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    sendEmpty(res, 204);
    return true;
  }

  if (req.method === 'POST') {
    res.setHeader('vary', 'Origin');
    if (originAllowed(req, allowedOrigins)) {
      res.setHeader('access-control-allow-origin', req.headers.origin.toLowerCase());
      res.setHeader('access-control-expose-headers', 'WWW-Authenticate, Retry-After');
    }
  }
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error('cuerpo_demasiado_grande'), { code: 'too_large' }));
        req.pause();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function validateMessage(value) {
  if (Array.isArray(value)) return { error: 'invalid_rpc', reason: 'batch_no_soportado' };
  if (!value || typeof value !== 'object' || value.jsonrpc !== '2.0') return { error: 'invalid_rpc', reason: 'mensaje_invalido' };
  if (!('method' in value)) {
    if ('result' in value || 'error' in value) return { error: 'invalid_rpc', reason: 'respuesta_no_soportada' };
    return { error: 'invalid_rpc', reason: 'mensaje_invalido' };
  }
  if (typeof value.method !== 'string' || !value.method) return { error: 'invalid_rpc', reason: 'mensaje_invalido' };
  if ('params' in value && (!value.params || typeof value.params !== 'object')) return { error: 'invalid_rpc', reason: 'mensaje_invalido' };
  if ('id' in value && typeof value.id !== 'string' && typeof value.id !== 'number') return { error: 'invalid_rpc', reason: 'id_invalido' };
  if (typeof value.id === 'string' && value.id.startsWith('omnia-init-')) return { error: 'invalid_rpc', reason: 'id_reservado' };
  return null;
}

function bridgeError(code) {
  return Object.assign(new Error(code), { code });
}

function parseSseEvent(raw) {
  let event = 'message';
  const data = [];
  for (const line of raw.split(/\r\n|\r|\n/)) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return data.length ? { event, data: data.join('\n') } : null;
}

function createEventChannel(signal) {
  const events = [];
  const waiters = new Set();
  let ended = false;
  let failure = null;

  function flush() {
    for (const waiter of [...waiters]) {
      const index = events.findIndex(waiter.predicate);
      if (index >= 0) {
        const [event] = events.splice(index, 1);
        waiters.delete(waiter);
        waiter.cleanup();
        waiter.resolve(event);
      } else if (failure || ended || signal.aborted) {
        waiters.delete(waiter);
        waiter.cleanup();
        waiter.reject(failure || signal.reason || bridgeError('upstream_unreachable'));
      }
    }
  }

  return {
    push(event) { events.push(event); flush(); },
    close() { ended = true; flush(); },
    fail(error) { failure = error; flush(); },
    wait(predicate) {
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, reject, cleanup: () => {} };
        const onAbort = () => {
          waiters.delete(waiter);
          waiter.cleanup();
          reject(signal.reason || bridgeError('upstream_unreachable'));
        };
        waiter.cleanup = () => signal.removeEventListener('abort', onAbort);
        waiters.add(waiter);
        signal.addEventListener('abort', onAbort, { once: true });
        flush();
      });
    },
  };
}

function responseFromEvent(event, id) {
  if (event.event !== 'message') return null;
  let message;
  try { message = JSON.parse(event.data); } catch { return null; }
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  if (message.method !== undefined || (!('result' in message) && !('error' in message))) return null;
  return message.id === id ? message : null;
}

async function readSse(response, channel) {
  if (!response.body) throw bridgeError('upstream_unreachable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      channel.close();
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer))) {
      const raw = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      const event = parseSseEvent(raw);
      if (event) channel.push(event);
    }
  }
}

async function bridge({ req, res, route, user, message, target }) {
  const controller = new AbortController();
  let timedOut = false;
  const configured = Number(process.env.ACCESS_STREAMABLE_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(bridgeError('upstream_timeout'));
  }, timeoutMs);
  const close = () => controller.abort(bridgeError('client_closed'));
  res.on('close', close);

  try {
    const base = new URL(route.upstream);
    const path = target.kind === 'mem0'
      ? `/mcp/streamable/sse/${canonicalMem0Namespace(target.segment)}`
      : '/mcp';
    const upstreamHeaders = {
      'x-omnia-dev': user.id,
      ...(route.upstreamAuth ? { authorization: route.upstreamAuth } : {}),
    };
    const getResponse = await fetch(new URL(path, base), {
      headers: { ...upstreamHeaders, accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (getResponse.status !== 200) throw bridgeError('upstream_unreachable');

    const channel = createEventChannel(controller.signal);
    readSse(getResponse, channel).catch((error) => channel.fail(error));
    const endpointEvent = await channel.wait((event) => event.event === 'endpoint');
    const endpoint = new URL(endpointEvent.data.trim(), base);
    if (endpoint.origin !== base.origin) throw bridgeError('upstream_unreachable');

    const post = async (body) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { ...upstreamHeaders, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status < 200 || response.status >= 300) throw bridgeError('upstream_unreachable');
    };
    const waitResponse = async (id) => {
      const event = await channel.wait((candidate) => responseFromEvent(candidate, id) !== null);
      return responseFromEvent(event, id);
    };

    if (message.method === 'initialize') {
      await post(message);
      return await waitResponse(message.id);
    }

    const initId = `omnia-init-${randomBytes(8).toString('hex')}`;
    await post({
      jsonrpc: '2.0',
      id: initId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'omnia-access-streamable', version: '1' },
      },
    });
    const initialized = await waitResponse(initId);
    if ('error' in initialized) throw bridgeError('upstream_handshake_failed');
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await post(message);
    return await waitResponse(message.id);
  } catch (error) {
    if (timedOut) throw bridgeError('upstream_timeout');
    if (error?.code === 'upstream_handshake_failed') throw error;
    throw bridgeError('upstream_unreachable');
  } finally {
    clearTimeout(timer);
    res.off('close', close);
    controller.abort();
  }
}

export async function streamableAfterAuth({ req, res, route, pathname, user, decide, allowedOrigins = [] }) {
  const target = targetOf(route, pathname);
  if (!target || (target.kind === 'knowledge' && req.method === 'GET')) return false;

  if (req.method === 'POST' && req.headers.origin !== undefined && !originAllowed(req, allowedOrigins)) {
    sendJson(res, 403, { error: 'forbidden', reason: 'origin_no_permitido' });
    return true;
  }

  if (target.kind === 'knowledge-subpath') {
    if (req.method === 'POST' || req.method === 'GET') sendJson(res, 404, { error: 'not_found' });
    else {
      res.setHeader('allow', ALLOW);
      sendJson(res, 405, { error: 'method_not_allowed' });
    }
    return true;
  }

  if (req.method !== 'POST') {
    res.setHeader('allow', ALLOW);
    sendJson(res, 405, { error: 'method_not_allowed' });
    return true;
  }

  if (target.kind === 'knowledge' && req.headers['content-type'] === undefined) return false;

  const contentType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    sendJson(res, 415, { error: 'unsupported_media_type' });
    return true;
  }

  let raw;
  try {
    raw = await readBody(req);
  } catch (error) {
    const tooLarge = error?.code === 'too_large';
    sendJson(res, tooLarge ? 413 : 400, { error: tooLarge ? 'cuerpo_demasiado_grande' : 'cuerpo_ilegible' });
    return true;
  }

  const text = raw.toString('utf8');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
    return true;
  }
  const invalid = validateMessage(value);
  if (invalid) {
    sendJson(res, 400, invalid);
    return true;
  }
  const parsed = parseRpc(text);
  if (parsed.error) {
    sendJson(res, 400, parsed.error === 'invalid_json' ? { error: 'invalid_json' } : { error: 'invalid_rpc', reason: 'mensaje_invalido' });
    return true;
  }
  const message = parsed.msgs[0];

  if (target.kind === 'mem0') {
    const connection = checkMem0Connect(user, target.segment);
    if (!connection.ok) {
      if (!decide(connection)) return true;
    } else {
      const rpc = checkMem0Rpc(user, spaceFromMem0(target.segment), parsed.msgs);
      if (!rpc.ok && !decide(rpc)) return true;
    }
  } else {
    const rpc = checkKbRpc(user, parsed.msgs);
    if (!rpc.ok && !decide(rpc)) return true;
  }

  if (!('id' in message)) {
    sendEmpty(res, 202);
    return true;
  }

  try {
    const response = await bridge({ req, res, route, user, message, target });
    sendJson(res, 200, response);
  } catch (error) {
    sendJson(res, error?.code === 'upstream_timeout' ? 504 : 502, {
      error: error?.code === 'upstream_timeout' ? 'upstream_timeout' : error?.code === 'upstream_handshake_failed' ? 'upstream_handshake_failed' : 'upstream_unreachable',
    });
  }
  return true;
}
