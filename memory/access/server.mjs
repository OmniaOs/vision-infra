// Omnia memory access gateway.
//
// Una sola puerta, un token por dev, para las dos memorias:
//   memory.<dominio>  ->  Mem0 / OpenMemory (solo /mcp/*)
//   kb.<dominio>      ->  Basic Memory (omnia-knowledge)
//
// El dev manda `Authorization: Bearer <su token>`. El gateway lo valida contra
// hashes SHA-256 (ACCESS_DEVS), descarta ese header y pone el del backend, asi
// el dev nunca ve las credenciales reales de Mem0 ni de Basic Memory. Sin
// dependencias: solo modulos nativos de Node.

import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Headers que no se reenvian. `authorization` sale siempre: el token del dev
// nunca viaja al backend.
const DROP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'authorization',
  'x-omnia-dev',
]);

const DEV_LINE = /^[a-z0-9][a-z0-9._-]{0,31}:[0-9a-f]{64}$/;

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/** "ana:<sha256>,luis:<sha256>" (coma o salto de linea) -> Map(hash -> dev). */
export function parseDevs(text) {
  const devs = new Map();
  for (const raw of String(text || '').split(/[\n,]+/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (!DEV_LINE.test(line)) {
      throw new Error(`ACCESS_DEVS: linea invalida (esperaba id:sha256hex): "${line.slice(0, 40)}"`);
    }
    const [id, hash] = line.split(':');
    devs.set(hash, id);
  }
  return devs;
}

export function createGateway({ devs, routes, setupDir = path.join(HERE, 'setup'), log = () => {} }) {
  const setupFiles = { '/setup': 'connect.ps1', '/setup.sh': 'connect.sh' };

  return http.createServer((req, res) => {
    const t0 = Date.now();
    const host = String(req.headers.host || '').split(':')[0].toLowerCase();
    let url;
    try {
      url = new URL(req.url, 'http://gateway');
    } catch {
      return reply(res, 400, { error: 'bad_request' });
    }
    // WHATWG URL ya normaliza `..` y `%2e%2e`; se comprueba sobre `pathname`.
    const pathname = url.pathname;
    let dev = '-';
    res.on('close', () => log({
      t: new Date().toISOString(), dev, host, m: req.method, p: pathname,
      s: res.statusCode, ms: Date.now() - t0,
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

    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    dev = (m && devs.get(hashToken(m[1]))) || null;
    if (!dev) {
      dev = '-';
      res.setHeader('www-authenticate', 'Bearer');
      return reply(res, 401, { error: 'unauthorized' });
    }

    if (pathname === '/whoami') return reply(res, 200, { dev, route: route.name });

    if (/%2f|%5c/i.test(pathname) || !route.allow.some((p) => pathname.startsWith(p))) {
      return reply(res, 404, { error: 'not_found' });
    }

    proxy(req, res, route, dev, pathname + url.search);
  });
}

function reply(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function proxy(req, res, route, dev, upstreamPath) {
  const target = new URL(route.upstream);
  const lib = target.protocol === 'https:' ? https : http;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!DROP.has(k)) headers[k] = v;
  headers.host = target.host;
  headers['x-omnia-dev'] = dev;
  if (route.upstreamAuth) headers.authorization = route.upstreamAuth;

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
    // SSE: que ningun proxy intermedio acumule los eventos.
    if (String(out['content-type'] || '').startsWith('text/event-stream')) out['x-accel-buffering'] = 'no';
    res.writeHead(ur.statusCode, out);
    res.flushHeaders();
    ur.pipe(res);
  });

  up.on('error', () => {
    if (!res.headersSent) reply(res, 502, { error: 'upstream_unreachable' });
    else res.destroy();
  });
  // Si el cliente cierra (fin de una sesion SSE), se corta la conexion al backend.
  res.on('close', () => { if (!res.writableFinished) up.destroy(); });
  req.pipe(up);
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
  const devs = parseDevs(process.env.ACCESS_DEVS);
  if (devs.size === 0) console.error('AVISO: ACCESS_DEVS vacio, todo pedido dara 401.');
  const routes = routesFromEnv(process.env);
  for (const r of routes) {
    if (!r.upstreamAuth) console.error(`AVISO: la ruta ${r.name} no inyecta credenciales al backend.`);
  }
  const port = Number(process.env.PORT || 8080);
  createGateway({ devs, routes, log: (e) => console.log(JSON.stringify(e)) })
    .listen(port, () => console.error(`access gateway en :${port} (${devs.size} devs)`));
}
