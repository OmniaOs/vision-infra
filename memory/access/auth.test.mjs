// node --test memory/access
// Acceso al portal por usuario y contrasena (cookie), a traves del gateway completo.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';
import { hashPassword, verifyPassword, passwordProblem } from './auth.mjs';

const ADM = 'omnia_adm_token_0123456789abcdef';
const ENVT = 'omnia_env_token_0123456789abcdef';
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-auth-'));
const PW = 'una-contrasena-larga-1';
let clock = Date.now();
let gw, port, logs;
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

before(async () => {
  logs = [];
  gw = createGateway({
    store: createStore({ envText: `envuser:${hashToken(ENVT)}:miembro:int-frutal`, adminsText: `adm:${hashToken(ADM)}`, file: path.join(dir, 'users.json') }),
    routes: [{ name: 'panel', hosts: ['panel.test'], upstream: '', allow: [] }, { name: 'mem0', hosts: ['mem.test'], upstream: 'http://127.0.0.1:1', allow: ['/mcp/'] }],
    enforce: true, portalFile: path.join(dir, 'portal.json'), failedAuthPerMin: 1000,
    authOptions: { now: () => clock, idleMs: 60 * 60e3, absoluteMs: 3 * 3600e3 }, log: (e) => logs.push(e),
  });
  port = await listen(gw);
});
after(() => { gw.closeAllConnections?.(); gw.close(); });

function call(method, p, { token, cookie, csrf, body, origin = 'https://panel.test', host = 'panel.test' } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const headers = { host };
    if (token) headers.authorization = `Bearer ${token}`;
    if (cookie) headers.cookie = cookie;
    if (csrf) headers['x-csrf'] = csrf;
    if (origin && method !== 'GET') headers.origin = origin;
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
const admin = (m, p, body) => call(m, p, { token: ADM, body });
const inviteToken = (r) => /#invitacion=([\w-]+)/.exec(r.body.invite.link)[1];
const cookieOf = (r) => /^(omnia_sid=[^;]+)/.exec(r.headers['set-cookie'])[1];

async function newPerson(id, role = 'miembro', spaces = ['int-frutal']) {
  const r = await admin('POST', '/api/admin/users', { id, role, spaces });
  assert.equal(r.status, 201);
  const a = await call('POST', '/api/auth/accept-invite', { body: { token: inviteToken(r), password: PW } });
  assert.equal(a.status, 200);
  const l = await call('POST', '/api/auth/login', { body: { id, password: PW } });
  assert.equal(l.status, 200);
  return { mcpToken: r.body.token, cookie: cookieOf(l), csrf: l.body.csrf, login: l };
}

test('contrasenas: scrypt con sal, verificacion y politica', async () => {
  const h = await hashPassword(PW);
  assert.match(h, /^scrypt\$32768\$8\$1\$/);
  assert.notEqual(h, await hashPassword(PW), 'cada hash lleva sal distinta');
  assert.equal(await verifyPassword(PW, h), true);
  assert.equal(await verifyPassword('otra-contrasena-larga', h), false);
  assert.equal(await verifyPassword(PW, 'scrypt$999999999$8$1$AAAA$AAAA'), false, 'parametros absurdos se rechazan');
  assert.equal(await verifyPassword(PW, 'texto-cualquiera'), false);
  assert.match(passwordProblem('corta'), /12 caracteres/);
  assert.match(passwordProblem('aaaaaaaaaaaaaaaa'), /repetitiva/);
  assert.match(passwordProblem('mi-usuario-es-ana-123', 'ana'), /usuario/);
  assert.equal(passwordProblem(PW, 'ana'), null);
});

test('INVITACION: la persona elige su contrasena, el enlace sirve una sola vez y no es un token del MCP', async () => {
  const r = await admin('POST', '/api/admin/users', { id: 'ana', role: 'miembro', spaces: ['int-frutal'] });
  assert.match(r.body.invite.link, /^https:\/\/panel\.test\/#invitacion=[\w-]{30,}$/);
  const tok = inviteToken(r);
  assert.equal((await call('POST', '/api/auth/accept-invite', { body: { token: tok, password: 'corta' } })).status, 400);
  assert.equal((await call('POST', '/api/auth/accept-invite', { body: { token: 'inventado', password: PW } })).status, 410);
  assert.equal((await call('POST', '/api/auth/accept-invite', { body: { token: tok, password: PW } })).status, 200);
  assert.equal((await call('POST', '/api/auth/accept-invite', { body: { token: tok, password: PW + 'x' } })).status, 410, 'un solo uso');
  // el enlace no sirve como token del MCP ni del API
  assert.equal((await call('GET', '/api/me', { token: tok })).status, 401);
});

test('LOGIN: cookie HttpOnly + Secure + SameSite=Strict, sin token ni contrasena en la respuesta', async () => {
  const p = await newPerson('luis');
  const sc = String(p.login.headers['set-cookie']);
  assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Strict/); assert.match(sc, /Path=\//);
  assert.equal(p.login.text.includes(PW), false);
  assert.equal(p.login.text.includes(p.mcpToken), false);
  const me = await call('GET', '/api/me', { cookie: p.cookie });
  assert.deepEqual([me.body.id, me.body.via, me.body.role, me.body.portal], ['luis', 'cookie', 'miembro', true]);
  assert.equal(me.body.csrf, p.csrf);
});

test('fallos de login: mismo mensaje exista o no la persona, y no revelan nada', async () => {
  const a = await call('POST', '/api/auth/login', { body: { id: 'luis', password: 'incorrecta-incorrecta' } });
  const b = await call('POST', '/api/auth/login', { body: { id: 'no-existe', password: 'incorrecta-incorrecta' } });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.equal(a.text, b.text, 'mismo cuerpo');
  assert.equal(a.headers['set-cookie'], undefined);
  assert.equal((await call('POST', '/api/auth/login', { body: { id: 'luis' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { id: { $ne: 1 }, password: PW } })).status, 401);
});

test('CSRF: una escritura con cookie exige origen propio y la marca de la sesion', async () => {
  const p = await newPerson('csrf1');
  const body = { current: PW, next: 'otra-contrasena-larga-2' };
  assert.equal((await call('POST', '/api/auth/password', { cookie: p.cookie, body })).status, 403, 'sin x-csrf');
  assert.equal((await call('POST', '/api/auth/password', { cookie: p.cookie, csrf: 'mala', body })).status, 403, 'x-csrf incorrecto');
  assert.equal((await call('POST', '/api/auth/password', { cookie: p.cookie, csrf: p.csrf, body, origin: 'https://evil.test' })).status, 403, 'origen ajeno');
  assert.equal((await call('POST', '/api/auth/password', { cookie: p.cookie, csrf: p.csrf, body, origin: null })).status, 403, 'sin origin');
  assert.equal((await call('POST', '/api/auth/password', { cookie: p.cookie, csrf: p.csrf, body })).status, 200);
});

test('los permisos se aplican AL INSTANTE a quien ya tiene sesion; la baja cierra el portal', async () => {
  const p = await newPerson('rol1');
  assert.equal((await call('GET', '/api/admin/users', { cookie: p.cookie })).status, 403, 'un miembro no administra');
  assert.equal((await admin('PATCH', '/api/admin/users/rol1', { role: 'admin' })).status, 200);
  assert.equal((await call('GET', '/api/admin/users', { cookie: p.cookie })).status, 200, 'ya es admin sin volver a entrar');
  assert.equal((await admin('PATCH', '/api/admin/users/rol1', { role: 'lectura' })).status, 200);
  assert.equal((await call('GET', '/api/admin/users', { cookie: p.cookie })).status, 403, 'y deja de serlo al instante');
  assert.equal((await admin('DELETE', '/api/admin/users/rol1')).status, 200);
  assert.equal((await call('GET', '/api/me', { cookie: p.cookie })).status, 401, 'la sesion muere con la baja');
  assert.equal((await call('POST', '/api/auth/login', { body: { id: 'rol1', password: PW } })).status, 401);
});

test('un admin por cookie puede dar de alta, pero la escritura exige CSRF', async () => {
  const j = await newPerson('adm2', 'admin', []);
  const body = { id: 'nuevo1', role: 'lectura', spaces: [] };
  assert.equal((await call('POST', '/api/admin/users', { cookie: j.cookie, body })).status, 403);
  const ok = await call('POST', '/api/admin/users', { cookie: j.cookie, csrf: j.csrf, body });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.invite.link && ok.body.token);
});

test('BLOQUEO: tras 5 fallos se bloquea esa combinacion, incluso con la contrasena correcta; las demas siguen', async () => {
  const p = await newPerson('bloq1');
  const other = await newPerson('bloq2');
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { body: { id: 'bloq1', password: `mala-contrasena-${i}-xx` } });
  const blocked = await call('POST', '/api/auth/login', { body: { id: 'bloq1', password: PW } });
  assert.equal(blocked.status, 429);
  assert.equal((await call('POST', '/api/auth/login', { body: { id: 'bloq2', password: PW } })).status, 200, 'otra persona no se ve afectada');
  assert.equal((await call('GET', '/api/me', { cookie: p.cookie })).status, 200, 'la sesion ya abierta sigue');
  clock += 16 * 60e3; // pasa el bloqueo
  assert.equal((await call('POST', '/api/auth/login', { body: { id: 'bloq1', password: PW } })).status, 200);
  assert.ok(other);
});

test('CAMBIO DE CONTRASENA: la actual debe ser correcta, la anterior deja de servir y se cierran las otras sesiones', async () => {
  const p = await newPerson('pw1');
  const second = await call('POST', '/api/auth/login', { body: { id: 'pw1', password: PW } });
  const c2 = cookieOf(second);
  const next = 'contrasena-nueva-larga-3';
  assert.equal((await call('POST', '/api/auth/password', { cookie: p.cookie, csrf: p.csrf, body: { current: 'incorrecta-incorrecta', next } })).status, 403);
  assert.equal((await call('POST', '/api/auth/password', { cookie: p.cookie, csrf: p.csrf, body: { current: PW, next: 'corta' } })).status, 400);
  const r = await call('POST', '/api/auth/password', { cookie: p.cookie, csrf: p.csrf, body: { current: PW, next } });
  assert.equal(r.status, 200); assert.equal(r.body.sesiones_cerradas, 1);
  assert.equal((await call('GET', '/api/me', { cookie: c2 })).status, 401, 'la otra sesion se cerro');
  assert.equal((await call('GET', '/api/me', { cookie: p.cookie })).status, 200, 'la actual sigue');
  assert.equal((await call('POST', '/api/auth/login', { body: { id: 'pw1', password: PW } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { id: 'pw1', password: next } })).status, 200);
});

test('ROTAR EL PROPIO TOKEN: sirve en el MCP al instante, y las personas de Coolify no pueden', async () => {
  const p = await newPerson('rot1');
  assert.equal((await call('GET', '/whoami', { token: p.mcpToken, host: 'mem.test' })).status, 200);
  const r = await call('POST', '/api/me/rotate-token', { cookie: p.cookie, csrf: p.csrf, body: {} });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/whoami', { token: p.mcpToken, host: 'mem.test' })).status, 401, 'el viejo ya no sirve');
  assert.equal((await call('GET', '/whoami', { token: r.body.token, host: 'mem.test' })).body.dev, 'rot1');
  const e = await call('POST', '/api/me/rotate-token', { token: ENVT, body: {} });
  assert.equal(e.status, 409);
});

test('persona de Coolify (ACCESS_DEVS): el admin le abre el portal con una invitacion', async () => {
  const r = await admin('POST', '/api/admin/users/envuser/invite');
  assert.equal(r.status, 200);
  const tok = inviteToken(r);
  assert.equal((await call('POST', '/api/auth/accept-invite', { body: { token: tok, password: PW } })).status, 200);
  const l = await call('POST', '/api/auth/login', { body: { id: 'envuser', password: PW } });
  assert.equal(l.status, 200);
  assert.equal(l.body.role, 'miembro');
  assert.equal((await call('GET', '/api/admin/users', { cookie: cookieOf(l) })).status, 403);
  // restablecer: nueva invitacion, la anterior queda sin efecto
  const again = await admin('POST', '/api/admin/users/envuser/invite');
  assert.notEqual(inviteToken(again), tok);
  assert.equal((await admin('POST', '/api/admin/users/nadie/invite')).status, 404);
});

test('LOGOUT borra la sesion', async () => {
  const p = await newPerson('out1');
  const r = await call('POST', '/api/auth/logout', { cookie: p.cookie, csrf: p.csrf, body: {} });
  assert.equal(r.status, 200);
  assert.match(String(r.headers['set-cookie']), /Max-Age=0/);
  assert.equal((await call('GET', '/api/me', { cookie: p.cookie })).status, 401);
});

test('CADUCIDAD: la invitacion a las 24 h y la sesion por inactividad', async () => {
  const r = await admin('POST', '/api/admin/users', { id: 'cad1', role: 'lectura', spaces: [] });
  const tok = inviteToken(r);
  const saved = clock;
  clock += 25 * 3600e3;
  assert.equal((await call('POST', '/api/auth/accept-invite', { body: { token: tok, password: PW } })).status, 410, 'invitacion caducada');
  const fresh = await admin('POST', '/api/admin/users/cad1/invite');
  assert.equal((await call('POST', '/api/auth/accept-invite', { body: { token: inviteToken(fresh), password: PW } })).status, 200);
  const l = await call('POST', '/api/auth/login', { body: { id: 'cad1', password: PW } });
  const ck = cookieOf(l);
  clock += 30 * 60e3;
  assert.equal((await call('GET', '/api/me', { cookie: ck })).status, 200, 'activa dentro del limite');
  clock += 61 * 60e3;
  assert.equal((await call('GET', '/api/me', { cookie: ck })).status, 401, 'inactiva mas de 1 h');
  assert.ok(clock > saved);
});

test('el portal guarda solo hashes: ni contrasenas, ni invitaciones, ni sesiones en claro; y los logs tampoco', async () => {
  const raw = readFileSync(path.join(dir, 'portal.json'), 'utf8');
  assert.equal(raw.includes(PW), false);
  assert.match(raw, /scrypt\$/);
  const all = JSON.stringify(logs);
  assert.equal(all.includes(PW), false);
  assert.equal(/#invitacion|omnia_sid|omnia_[A-Za-z0-9_-]{30,}/.test(all), false);
  assert.ok(logs.some((l) => l.ev === 'login_fallido'));
  assert.ok(logs.some((l) => l.ev === 'login'));
});
