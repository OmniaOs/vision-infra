// API del portal (memorypanel.<dominio>). Mismo origen que las paginas: no hay CORS.
//
// Acceso: usuario y contrasena (cookie de sesion). El token del MCP NO se usa en el navegador; se
// acepta como Bearer solo para automatizar desde la terminal.
//
//   Publicas
//   POST   /api/auth/login                  {id, password}        -> cookie de sesion
//   POST   /api/auth/accept-invite          {token, password}     -> fija la contrasena
//   Con sesion (o Bearer)
//   GET    /api/me
//   POST   /api/auth/logout
//   POST   /api/auth/password               {current, next}
//   POST   /api/me/rotate-token             token MCP nuevo (una vez); solo personas del archivo
//   Solo admin
//   GET    /api/admin/users
//   POST   /api/admin/users                 {id, role, spaces}   -> token MCP + invitacion (una vez)
//   PATCH  /api/admin/users/:id             {role?, spaces?}
//   POST   /api/admin/users/:id/rotate      token MCP nuevo
//   POST   /api/admin/users/:id/invite      invitacion nueva (alta o restablecer contrasena)
//   DELETE /api/admin/users/:id             baja inmediata
//
// Las personas de ACCESS_DEVS / ACCESS_ADMINS se ven pero su rol y su token se cambian en Coolify.

import { randomBytes } from 'node:crypto';
import { hashToken } from './users.mjs';
import { validateUser } from './policy.mjs';

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(Object.assign(new Error('too_large'), { status: 413 })); req.pause(); } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('x');
        resolve(v);
      } catch { reject(Object.assign(new Error('json_invalido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const publicUser = (u, auth) => ({
  id: u.id, role: u.role, spaces: u.spaces, origin: u.origin || 'env', editable: u.origin === 'file',
  createdAt: u.createdAt || null, portal: auth.hasPassword(u.id),
});

export function createPanelApi({
  store, auth, closeSessions, log = () => {}, memoryDomain = 'memory.omniaos.ai', panelDomain = 'memorypanel.omniaos.ai',
}) {
  const newToken = () => `omnia_${randomBytes(32).toString('base64url')}`;
  const commands = (token) => ({
    windows: `$env:OMNIA_TOKEN='${token}'; irm https://${memoryDomain}/setup | iex`,
    unix: `OMNIA_TOKEN='${token}' bash -c "$(curl -fsSL https://${memoryDomain}/setup.sh)"`,
  });
  const inviteInfo = (id) => {
    const inv = auth.createInvite(id);
    return { link: `https://${panelDomain}/#invitacion=${inv.token}`, expiresAt: inv.expiresAt };
  };
  const exists = (id) => store.all().some((u) => u.id === id);
  const sender = (res) => (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };
  const fail = (res, e) => {
    const send = sender(res);
    if (e.status) return send(e.status, { error: e.message });
    log({ t: new Date().toISOString(), ev: 'panel_error', error: String(e.message).slice(0, 160) });
    return send(500, { error: 'interno' });
  };

  /** Endpoints sin sesion. Devuelve true si la peticion era suya. */
  async function handlePublic(req, res, url, ip, noteFail) {
    const send = sender(res);
    try {
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const b = await readJson(req);
        const r = await auth.login(b.id, b.password, ip, exists);
        if (!r.ok) {
          if (r.reason === 'bloqueado') return send(429, { error: 'demasiados_intentos', detail: 'Demasiados intentos. Espera unos minutos.' });
          noteFail(ip);
          log({ t: new Date().toISOString(), ev: 'login_fallido', id: String(b.id).slice(0, 32), ip });
          return send(401, { error: 'credenciales', detail: 'Usuario o contrasena incorrectos' });
        }
        const u = store.all().find((x) => x.id === r.id);
        log({ t: new Date().toISOString(), ev: 'login', id: r.id });
        return send(200, { id: u.id, role: u.role, spaces: u.spaces, csrf: r.csrf }, { 'set-cookie': auth.cookie(r.sid) });
      }
      if (url.pathname === '/api/auth/accept-invite' && req.method === 'POST') {
        const b = await readJson(req);
        const r = await auth.acceptInvite(b.token, b.password, exists);
        if (!r.ok) {
          if (r.reason === 'invitacion_invalida') noteFail(ip);
          return send(r.reason === 'contrasena_debil' ? 400 : 410, { error: r.reason, detail: r.detail || 'La invitacion no es valida o ya caduco' });
        }
        log({ t: new Date().toISOString(), ev: 'contrasena_fijada', id: r.id });
        return send(200, { ok: true, id: r.id });
      }
      return false;
    } catch (e) { fail(res, e); return true; }
  }

  /** Endpoints con sesion o Bearer. `ctx = { via: 'cookie'|'bearer', session }`. */
  async function handle(req, res, url, actor, ctx = { via: 'bearer' }) {
    const send = sender(res);
    const p = url.pathname;
    const audit = (action, target, extra = {}) => log({ t: new Date().toISOString(), ev: 'admin_action', by: actor.id, action, target, ...extra });

    try {
      // Con cookie, toda escritura exige el mismo origen y la marca CSRF de la sesion.
      if (ctx.via === 'cookie' && req.method !== 'GET') {
        let originOk = false;
        try { originOk = new URL(req.headers.origin || '').host === req.headers.host; } catch { /* sin origin */ }
        if (!originOk || !auth.csrfOk(ctx.session, req.headers['x-csrf'])) return send(403, { error: 'csrf' });
      }

      if (p === '/api/me' && req.method === 'GET') {
        return send(200, { id: actor.id, role: actor.role, spaces: actor.spaces, via: ctx.via, portal: auth.hasPassword(actor.id),
          ...(ctx.via === 'cookie' ? { csrf: ctx.session.csrf } : {}) });
      }
      if (p === '/api/auth/logout' && req.method === 'POST') {
        if (ctx.session) auth.logout(ctx.session.key);
        return send(200, { ok: true }, { 'set-cookie': auth.clearCookie() });
      }
      if (p === '/api/auth/password' && req.method === 'POST') {
        const b = await readJson(req);
        const r = await auth.changePassword(actor.id, b.current, b.next, ctx.session && ctx.session.key);
        if (!r.ok) return send(r.reason === 'contrasena_debil' ? 400 : 403, { error: r.reason, detail: r.detail });
        log({ t: new Date().toISOString(), ev: 'contrasena_cambiada', id: actor.id, sesiones_cerradas: r.cerradas });
        return send(200, { ok: true, sesiones_cerradas: r.cerradas });
      }
      if (p === '/api/me/rotate-token' && req.method === 'POST') {
        if (!store.writable) return send(503, { error: 'sin_archivo_de_usuarios' });
        const list = store.fileUsers();
        const i = list.findIndex((u) => u.id === actor.id);
        if (i < 0) return send(409, { error: 'gestionado_por_variable_de_entorno', detail: 'Tu token lo cambia un admin en Coolify' });
        const token = newToken();
        list[i] = { ...list[i], hash: hashToken(token) };
        store.setFileUsers(list);
        const cut = closeSessions(actor.id);
        log({ t: new Date().toISOString(), ev: 'token_propio_rotado', id: actor.id, sesiones_cerradas: cut });
        return send(200, { token, commands: commands(token), sesiones_cerradas: cut, aviso: 'Se muestra una sola vez; el anterior ya no sirve.' });
      }

      if (!p.startsWith('/api/admin/')) return send(404, { error: 'not_found' });
      if (actor.role !== 'admin') { audit('denegado', p); return send(403, { error: 'forbidden', reason: 'solo_admin' }); }
      if (!store.writable) return send(503, { error: 'sin_archivo_de_usuarios', detail: 'Falta ACCESS_USERS_FILE en el servidor' });

      if (p === '/api/admin/users' && req.method === 'GET') {
        return send(200, { users: store.all().map((u) => publicUser(u, auth)).sort((a, b) => a.id.localeCompare(b.id)) });
      }

      if (p === '/api/admin/users' && req.method === 'POST') {
        const b = await readJson(req);
        const rec = { id: b.id, role: b.role, spaces: b.spaces ?? [] };
        const err = validateUser(rec);
        if (err) return send(400, { error: 'invalido', detail: err });
        if (exists(rec.id)) return send(409, { error: 'ya_existe' });
        const token = newToken();
        store.setFileUsers([...store.fileUsers(), { ...rec, hash: hashToken(token), active: true, createdAt: new Date().toISOString() }]);
        audit('alta', rec.id, { role: rec.role, spaces: rec.spaces });
        return send(201, { user: { id: rec.id, role: rec.role, spaces: rec.spaces }, token, commands: commands(token), invite: inviteInfo(rec.id),
          aviso: 'El token del MCP y la invitacion al portal se muestran una sola vez y no se guardan en claro.' });
      }

      const m = /^\/api\/admin\/users\/([^/]+?)(\/rotate|\/invite)?$/.exec(p);
      if (!m) return send(404, { error: 'not_found' });
      const id = decodeURIComponent(m[1]);
      if (!ID_RE.test(id)) return send(400, { error: 'id_invalido' });
      const target = store.all().find((u) => u.id === id);
      if (!target) return send(404, { error: 'no_existe' });

      if (m[2] === '/invite' && req.method === 'POST') { // alta de acceso al portal o restablecer contrasena
        audit('invitacion', id);
        return send(200, { id, invite: inviteInfo(id), aviso: 'Se muestra una sola vez; sustituye a la invitacion anterior.' });
      }

      if (target.origin !== 'file') return send(409, { error: 'gestionado_por_variable_de_entorno', detail: 'Se cambia en Coolify (ACCESS_DEVS / ACCESS_ADMINS)' });
      const list = store.fileUsers();
      const idx = list.findIndex((u) => u.id === id);
      if (idx < 0) return send(404, { error: 'no_existe' });

      if (m[2] === '/rotate' && req.method === 'POST') {
        const token = newToken();
        list[idx] = { ...list[idx], hash: hashToken(token) };
        store.setFileUsers(list);
        const cut = closeSessions(id);
        audit('rotar_token', id, { sesiones_cerradas: cut });
        return send(200, { user: { id }, token, commands: commands(token), sesiones_cerradas: cut,
          aviso: 'El token anterior ya no sirve. Este se muestra una sola vez.' });
      }

      if (req.method === 'PATCH') {
        const b = await readJson(req);
        const next = { ...list[idx], role: b.role ?? list[idx].role, spaces: b.spaces ?? list[idx].spaces };
        const err = validateUser(next);
        if (err) return send(400, { error: 'invalido', detail: err });
        if (id === actor.id && next.role !== 'admin') return send(409, { error: 'no_puedes_quitarte_el_rol_admin' });
        list[idx] = next;
        store.setFileUsers(list);
        const cut = closeSessions(id); // las sesiones del MCP se reabren con los permisos nuevos
        audit('cambio', id, { role: next.role, spaces: next.spaces, sesiones_cerradas: cut });
        return send(200, { user: publicUser({ ...next, origin: 'file' }, auth), sesiones_cerradas: cut });
      }

      if (req.method === 'DELETE') {
        if (id === actor.id) return send(409, { error: 'no_puedes_darte_de_baja_a_ti_mismo' });
        list.splice(idx, 1);
        store.setFileUsers(list);
        const cut = closeSessions(id) + auth.removeUser(id);
        audit('baja', id, { sesiones_cerradas: cut });
        return send(200, { ok: true, sesiones_cerradas: cut });
      }
      return send(405, { error: 'method_not_allowed' });
    } catch (e) { return fail(res, e); }
  }

  return { handle, handlePublic };
}
