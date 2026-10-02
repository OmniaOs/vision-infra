// Omnia memory access gateway.
//
// Una sola puerta, un token por persona, para las dos memorias:
//   memory.<dominio>  ->  Mem0 / OpenMemory (solo /mcp/*)
//   kb.<dominio>      ->  Basic Memory (omnia-knowledge)
//
// El dev manda `Authorization: Bearer <su token>`. El gateway lo valida contra
// hashes SHA-256, descarta ese header y pone el del backend. Ademas aplica
// roles y espacios (policy.mjs): conexion a un namespace, herramientas y
// argumentos de cada mensaje MCP. Con ACCESS_ENFORCE apagado solo AUDITA:
// registra lo que denegaria sin bloquearlo (despliegue por etapas, ver
// memory/PERMISOS.md). Sin dependencias: solo modulos nativos de Node.

import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createStore, storeFromLegacy, hashToken } from './users.mjs';
import { checkKbRpc, checkMem0Connect, checkMem0Rpc, parseRpc, spaceFromMem0 } from './policy.mjs';
import { createPanelApi } from './panel.mjs';
import { createAuth } from './auth.mjs';
import { createViewerApi } from './viewer.mjs';
import { createAliasStore } from './aliases.mjs';

export { hashToken };

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Headers que no se reenvian. `authorization` sale siempre: el token del dev
// nunca viaja al backend.
const DROP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'authorization',
  'x-omnia-dev', 'x-omnia-role',
]);

const BODY_LIMIT = 256 * 1024;

// Portal: el build de Vite (panel/). Se sirve con una busqueda segura (nada fuera de panel/) y las
// rutas sin extension caen en index.html (la app navega en el navegador).
const PANEL_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
};
// Sin scripts ni estilos en linea: lo que un cliente escriba en una nota nunca puede ejecutarse.
// Los estilos que Radix inyecta llevan el nonce de cada respuesta (solo en la pagina de entrada).
const PANEL_BASE_CSP = "default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const PANEL_HEADERS = {
  'content-security-policy': `${PANEL_BASE_CSP}; style-src 'self'`,
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'cache-control': 'no-store',
};
const ipOf = (req) => String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '?';

function readBody(req, limit = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(Object.assign(new Error('too_large'), { code: 'too_large' })); req.pause(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createGateway({
  devs, store, routes, enforce = false, rateLimitPerMin = 1200,
  setupDir = path.join(HERE, 'setup'), panelDir = path.join(HERE, 'panel'), memoryDomain, failedAuthPerMin = 30,
  portalFile, secureCookie = true, authOptions = {}, viewerOptions = {}, aliasFile, aliasEnv = '', log = () => {},
}) {
  const users = store || storeFromLegacy(devs || new Map());
  const setupFiles = { '/setup': 'connect.ps1', '/setup.sh': 'connect.sh' };

  const panelRoot = path.resolve(panelDir) + path.sep;
  function servePanelFile(res, pathname) {
    try {
      let rel;
      try { rel = decodeURIComponent(pathname); } catch { return reply(res, 404, { error: 'not_found' }); }
      if (rel.includes('\0')) return reply(res, 404, { error: 'not_found' });
      const ext = path.extname(rel).toLowerCase();
      if (ext && !PANEL_TYPES[ext]) return reply(res, 404, { error: 'not_found' });
      // Sin extension = ruta de la app: se entrega la pagina de entrada.
      const isPage = !ext || ext === '.html';
      const file = path.resolve(panelDir, isPage ? 'index.html' : '.' + rel);
      if (!file.startsWith(panelRoot)) return reply(res, 404, { error: 'not_found' });
      let body = readFileSync(file);
      const headers = { ...PANEL_HEADERS, 'content-type': PANEL_TYPES[isPage ? '.html' : ext] };
      if (isPage) {
        const nonce = randomBytes(16).toString('base64');
        body = Buffer.from(body.toString('utf8').replaceAll('__CSP_NONCE__', nonce));
        headers['content-security-policy'] = `${PANEL_BASE_CSP}; style-src 'self' 'nonce-${nonce}'`;
      } else if (rel.startsWith('/assets/')) {
        headers['cache-control'] = 'public, max-age=31536000, immutable'; // nombres con hash del contenido
      }
      res.writeHead(200, headers);
      return res.end(body);
    } catch {
      return reply(res, 404, { error: 'not_found' });
    }
  }
  /** session_id -> { dev, kind, space, res } */
  const sessions = new Map();
  const hits = new Map(); // dev -> { windowStart, n }
  const fails = new Map(); // ip -> { windowStart, n }  (intentos con token invalido)

  function rateOk(dev) {
    const now = Date.now();
    const h = hits.get(dev);
    if (!h || now - h.windowStart >= 60000) { hits.set(dev, { windowStart: now, n: 1 }); return true; }
    return ++h.n <= rateLimitPerMin;
  }

  const failedTooMuch = (ip) => { const f = fails.get(ip); return Boolean(f) && Date.now() - f.windowStart < 60000 && f.n >= failedAuthPerMin; };
  const noteFail = (ip) => {
    const now = Date.now();
    const f = fails.get(ip);
    if (!f || now - f.windowStart >= 60000) fails.set(ip, { windowStart: now, n: 1 }); else f.n++;
  };

  /** Corta las conexiones SSE de una persona o, con `tid`, solo las de ese token. */
  function closeSessions(devId, tid) {
    let n = 0;
    for (const [sid, s] of sessions) if (s.dev === devId && (!tid || s.tid === tid)) { s.res.destroy(); sessions.delete(sid); n++; }
    return n;
  }

  /** Corta las conexiones SSE ligadas a un espacio (cuando cambia a que namespace corresponde). */
  function closeSpace(space) {
    let n = 0;
    for (const [sid, s] of sessions) if (s.space === space) { s.res.destroy(); sessions.delete(sid); n++; }
    return n;
  }

  /** Cierra las sesiones de quien ya no existe o cambio de rol/espacios. */
  function sweepSessions() {
    for (const [sid, s] of sessions) {
      const u = s.userSnapshot && users.all().find((x) => x.id === s.dev);
      if (!u || u.role !== s.role || JSON.stringify(u.spaces) !== s.spacesKey) {
        s.res.destroy();
        sessions.delete(sid);
        log({ t: new Date().toISOString(), ev: 'sesion_cerrada', dev: s.dev, motivo: u ? 'permisos_cambiados' : 'baja' });
      }
    }
  }

  const auth = createAuth({ file: portalFile, secureCookie, ...authOptions });
  const aliasStore = createAliasStore({ file: aliasFile, envText: aliasEnv, log });
  const viewer = createViewerApi({ routes, store: users, log, ...viewerOptions });
  const panelApi = createPanelApi({
    store: users, auth, closeSessions, closeSpace, aliases: aliasStore, log, viewer,
    memoryDomain: memoryDomain || (routes.find((r) => r.name === 'mem0')?.hosts[0]) || 'memory.omniaos.ai',
    panelDomain: routes.find((r) => r.name === 'panel')?.hosts[0] || 'memorypanel.omniaos.ai',
  });

  const server = http.createServer(async (req, res) => {
    const t0 = Date.now();
    const host = String(req.headers.host || '').split(':')[0].toLowerCase();
    let url;
    try {
      url = new URL(req.url, 'http://gateway');
    } catch {
      return reply(res, 400, { error: 'bad_request' });
    }
    const pathname = url.pathname;
    let dev = '-';
    let pol = '';
    res.on('close', () => log({
      t: new Date().toISOString(), dev, host, m: req.method, p: pathname,
      s: res.statusCode, ms: Date.now() - t0, ...(pol ? { pol } : {}),
    }));

    if (pathname === '/healthz') return reply(res, 200, { ok: true });

    if (req.method === 'GET' && setupFiles[pathname]) {
      try {
        const body = readFileSync(path.join(setupDir, setupFiles[pathname]));
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(body);
      } catch {
        return reply(res, 404, { error: 'not_found' });
      }
    }

    const route = routes.find((r) => r.hosts.includes(host));
    if (!route) return reply(res, 404, { error: 'not_found' });

    // Portal: publico (no lleva datos); todo lo demas exige sesion o token.
    if (route.name === 'panel' && req.method === 'GET' && !pathname.startsWith('/api/')) {
      return servePanelFile(res, pathname);
    }

    const ip = ipOf(req);

    if (route.name === 'panel') {
      for (const [k, v] of Object.entries(PANEL_HEADERS)) res.setHeader(k, v);
      if (!pathname.startsWith('/api/')) return reply(res, 404, { error: 'not_found' });
      // Entrada y canje de invitacion: sin sesion, con limite por origen.
      if (req.method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/auth/accept-invite')) {
        if (failedTooMuch(ip)) { pol = 'demasiados_intentos'; res.setHeader('retry-after', '60'); return reply(res, 429, { error: 'too_many_requests' }); }
        return panelApi.handlePublic(req, res, url, ip, noteFail);
      }
      // Persona: sesion por cookie (navegador) o Bearer (automatizacion desde terminal).
      let actor = null; let ctx = { via: 'cookie' };
      const bm = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
      if (bm) {
        actor = users.lookup(hashToken(bm[1]));
        ctx = { via: 'bearer' };
        users.touch(actor, { ip, agent: req.headers['user-agent'] });
      } else {
        const s = auth.session(req.headers.cookie);
        if (s) { actor = users.byId(s.id); ctx = { via: 'cookie', session: s }; if (!actor) auth.logout(s.key); }
      }
      if (!actor) {
        if (bm) {
          if (failedTooMuch(ip)) { pol = 'demasiados_intentos'; res.setHeader('retry-after', '60'); return reply(res, 429, { error: 'too_many_requests' }); }
          noteFail(ip);
        }
        return reply(res, 401, { error: 'unauthorized' });
      }
      dev = actor.id;
      if (!rateOk(dev)) { pol = 'rate_limit'; res.setHeader('retry-after', '60'); return reply(res, 429, { error: 'too_many_requests' }); }
      return panelApi.handle(req, res, url, actor, ctx);
    }

    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    const user = (m && users.lookup(hashToken(m[1]))) || null;
    if (!user) {
      // El limite solo frena a quien manda tokens INVALIDOS: un token valido nunca se bloquea por los
      // fallos de otros (misma oficina, mismo NAT). Los tokens de 256 bits no se adivinan; esto solo
      // evita inundar el log y gastar CPU.
      if (failedTooMuch(ip)) { pol = 'demasiados_intentos'; res.setHeader('retry-after', '60'); return reply(res, 429, { error: 'too_many_requests' }); }
      noteFail(ip);
      res.setHeader('www-authenticate', 'Bearer');
      return reply(res, 401, { error: 'unauthorized' });
    }
    dev = user.id;
    users.touch(user, { ip, agent: req.headers['user-agent'] });

    if (pathname === '/whoami') return reply(res, 200, { dev, route: route.name, role: user.role });
    if (!rateOk(dev)) { pol = 'rate_limit'; res.setHeader('retry-after', '60'); return reply(res, 429, { error: 'too_many_requests' }); }

    /** Aplica un veredicto de la politica. Devuelve true si la peticion sigue. */
    const decide = (r) => {
      if (r.ok) return true;
      pol = enforce ? `deny:${r.reason}` : `would_deny:${r.reason}`;
      if (enforce) { reply(res, 403, { error: 'forbidden', reason: r.reason }); return false; }
      return true;
    };

    if (/%2f|%5c/i.test(pathname)) return reply(res, 404, { error: 'not_found' });

    const isMem0 = route.name === 'mem0';
    const track = (space) => (sid) => {
      sessions.set(sid, {
        dev, tid: user.tokenId, kind: route.name, space, res, userSnapshot: true, role: user.role, spacesKey: JSON.stringify(user.spaces),
      });
      res.on('close', () => sessions.delete(sid));
    };

    // ----- admin: sin restricciones de politica, solo la lista de rutas -----
    // Sus sesiones tambien se registran: una baja o un cambio de rol debe poder cortarlas.
    if (user.role === 'admin') {
      if (!route.allow.some((p) => pathname.startsWith(p))) return reply(res, 404, { error: 'not_found' });
      const adminSse = req.method === 'GET' && (isMem0 ? /^\/mcp\/[a-z0-9_-]{1,32}\/sse\/[^/]+$/.test(pathname) : pathname === '/mcp');
      return proxy(req, res, route, user, pathname + url.search, adminSse ? { onSession: track(null) } : {});
    }

    // ----- apertura de sesion SSE -----
    const sse = isMem0 ? /^\/mcp\/([a-z0-9_-]{1,32})\/sse\/([^/]+)$/.exec(pathname) : (pathname === '/mcp' ? [] : null);
    if (req.method === 'GET' && sse) {
      let space = null;
      if (isMem0) {
        if (!decide(checkMem0Connect(user, sse[2]))) return;
        space = spaceFromMem0(sse[2]);
      }
      return proxy(req, res, route, user, pathname + url.search, { onSession: track(space) });
    }

    // ----- mensajes de una sesion -----
    const post = req.method === 'POST' && (isMem0
      ? /^\/mcp\/messages\/?$|^\/mcp\/[a-z0-9_-]{1,32}\/sse\/([^/]+)\/messages\/?$/.exec(pathname)
      : /^\/messages\/?$/.exec(pathname));
    if (post) {
      let raw;
      try { raw = await readBody(req); } catch (e) {
        pol = e.code === 'too_large' ? 'cuerpo_demasiado_grande' : 'cuerpo_ilegible';
        return reply(res, e.code === 'too_large' ? 413 : 400, { error: pol });
      }
      const sid = url.searchParams.get('session_id');
      const session = sid ? sessions.get(sid) : null;
      if (!session || session.dev !== dev) {
        if (!decide({ ok: false, reason: 'sesion_desconocida' })) return;
      }
      const parsed = parseRpc(raw.toString('utf8'));
      if (parsed.error) {
        if (!decide({ ok: false, reason: parsed.error })) return;
      } else if (session) {
        // la ruta con namespace debe coincidir con el de la sesion
        if (isMem0 && post[1] !== undefined && spaceFromMem0(post[1]) !== session.space) {
          if (!decide({ ok: false, reason: 'namespace_distinto_al_de_la_sesion' })) return;
        }
        const r = isMem0 ? checkMem0Rpc(user, session.space, parsed.msgs) : checkKbRpc(user, parsed.msgs);
        if (!decide(r)) return;
      }
      return proxy(req, res, route, user, pathname + url.search, { body: raw });
    }

    // ----- cualquier otra ruta -----
    if (!decide({ ok: false, reason: 'ruta_no_permitida' })) return;
    if (!route.allow.some((p) => pathname.startsWith(p))) return reply(res, 404, { error: 'not_found' });
    return proxy(req, res, route, user, pathname + url.search, {});
  });

  server.closeSessions = closeSessions;
  server.sweepSessions = sweepSessions;
  server.sessionCount = () => sessions.size;
  const timer = setInterval(sweepSessions, 5000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return server;
}

function reply(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function proxy(req, res, route, user, upstreamPath, { body, onSession }) {
  const target = new URL(route.upstream);
  const lib = target.protocol === 'https:' ? https : http;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!DROP.has(k)) headers[k] = v;
  headers.host = target.host;
  headers['x-omnia-dev'] = user.id;
  if (route.upstreamAuth) headers.authorization = route.upstreamAuth;
  if (body) headers['content-length'] = String(body.length);

  const up = lib.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: upstreamPath,
    headers,
  }, (ur) => {
    const out = { ...ur.headers };
    delete out.connection;
    const isSse = String(out['content-type'] || '').startsWith('text/event-stream');
    // SSE: que ningun proxy intermedio acumule los eventos.
    if (isSse) out['x-accel-buffering'] = 'no';
    res.writeHead(ur.statusCode, out);
    res.flushHeaders();
    if (isSse && onSession) {
      // El backend anuncia el session_id en el primer evento; hay que asociarlo al dev y al espacio.
      let seen = '';
      const tap = (c) => {
        if (seen === null) return;
        seen += c.toString('latin1');
        const sm = /session_id=([A-Za-z0-9_-]{8,64})/.exec(seen);
        if (sm) { onSession(sm[1]); seen = null; } else if (seen.length > 4096) seen = null;
      };
      ur.on('data', tap);
    }
    ur.pipe(res);
  });

  up.on('error', () => {
    if (!res.headersSent) reply(res, 502, { error: 'upstream_unreachable' });
    else res.destroy();
  });
  // Si el cliente cierra (fin de una sesion SSE), se corta la conexion al backend.
  res.on('close', () => { if (!res.writableFinished) up.destroy(); });
  if (body) up.end(body); else req.pipe(up);
}

/** Rutas a partir de variables de entorno. */
export function routesFromEnv(env) {
  const list = (v) => String(v).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [
    {
      name: 'mem0',
      hosts: list(env.MEM0_HOSTS || 'memory.omniaos.ai'),
      upstream: env.MEM0_UPSTREAM || 'http://openmemory-mcp:8765',
      upstreamAuth: env.OPENMEMORY_API_KEY ? `Bearer ${env.OPENMEMORY_API_KEY}` : undefined,
      allow: ['/mcp/'], // nada de /api, /docs ni el resto de OpenMemory
    },
    { name: 'panel', hosts: list(env.PANEL_HOSTS || 'memorypanel.omniaos.ai'), upstream: '', allow: [] },
    {
      name: 'knowledge',
      hosts: list(env.KB_HOSTS || 'kb.omniaos.ai'),
      upstream: env.KB_UPSTREAM || 'https://knowledge.omniaos.ai',
      upstreamAuth: env.KB_UPSTREAM_AUTH_B64 ? `Basic ${env.KB_UPSTREAM_AUTH_B64}` : undefined,
      allow: ['/'],
    },
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = createStore({
    envText: process.env.ACCESS_DEVS,
    adminsText: process.env.ACCESS_ADMINS,
    file: process.env.ACCESS_USERS_FILE,
    log: (e) => console.log(JSON.stringify({ t: new Date().toISOString(), ...e })),
  });
  if (store.size === 0) console.error('AVISO: no hay usuarios, todo pedido dara 401.');
  const enforce = process.env.ACCESS_ENFORCE === '1';
  console.error(`politicas: ${enforce ? 'ACTIVAS (se bloquea)' : 'en AUDITORIA (solo se registra lo que se denegaria)'}`);
  const routes = routesFromEnv(process.env);
  for (const r of routes) {
    if (!r.upstreamAuth) console.error(`AVISO: la ruta ${r.name} no inyecta credenciales al backend.`);
  }
  const port = Number(process.env.PORT || 8080);
  createGateway({ store, routes, enforce, portalFile: process.env.ACCESS_PORTAL_FILE,
    aliasFile: process.env.ACCESS_ALIASES_FILE, aliasEnv: process.env.ACCESS_NAMESPACE_ALIASES,
    viewerOptions: { qdrantUrl: process.env.QDRANT_URL, qdrantCollection: process.env.QDRANT_COLLECTION, qdrantKey: process.env.QDRANT_API_KEY }, log: (e) => console.log(JSON.stringify(e)) })
    .listen(port, () => console.error(`access gateway en :${port} (${store.size} usuarios)`));
}
