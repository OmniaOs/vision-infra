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
//   GET    /api/me/tokens                   mis tokens (nombre, creacion, ultimo uso, dispositivo, estado)
//   POST   /api/me/tokens {label}           token nuevo (una vez); con sesion del portal (o Bearer de un admin)
//   DELETE /api/me/tokens/:tid              revocar uno mio (corta sus conexiones al instante)
//   Solo admin
//   GET    /api/admin/users
//   POST   /api/admin/users                 {id, role, spaces}   -> token MCP + invitacion (una vez)
//   PATCH  /api/admin/users/:id             {role?, spaces?}
//   GET    /api/admin/tokens                todos los tokens de todas las personas
//   GET|POST /api/admin/users/:id/tokens    ver o crear tokens de una persona
//   POST   /api/admin/users/:id/tokens/revoke-all   revocar todos los del portal de una persona
//   DELETE /api/admin/tokens/:tid           revocar cualquiera del portal
//   POST   /api/admin/users/:id/adopt       migrar una persona de ACCESS_DEVS al portal (mismo token)
//   POST   /api/admin/users/:id/invite      invitacion nueva (alta o restablecer contrasena)
//   DELETE /api/admin/users/:id             baja inmediata
//
// Las personas de ACCESS_DEVS / ACCESS_ADMINS se ven; su rol se cambia en Coolify hasta migrarlas al portal.
// Sus tokens de Coolify se ven pero no se revocan aqui; los tokens del portal si.

import { randomBytes } from 'node:crypto';
import { hashToken, TOKEN_LIMIT } from './users.mjs';
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

const publicUser = (u, auth, tokens = []) => {
  const active = tokens.filter((t) => !t.revokedAt);
  return {
    id: u.id, role: u.role, spaces: u.spaces, origin: u.origin || 'env', editable: u.origin === 'file',
    createdAt: u.createdAt || null, portal: auth.hasPassword(u.id),
    tokenCount: active.length, lastUsedAt: active.map((t) => t.lastUsedAt).filter(Boolean).sort().pop() || null,
  };
};

export function createPanelApi({
  store, auth, closeSessions, viewer, log = () => {}, memoryDomain = 'memory.omniaos.ai', panelDomain = 'memorypanel.omniaos.ai',
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
  const labelOf = (b) => (typeof b.label === 'string' ? b.label.trim() : '');
  /** Crea un token del portal para `userId`. Devuelve [status, cuerpo]. */
  function issueToken(userId, label, createdBy) {
    if (!store.writable) return [503, { error: 'sin_archivo_de_usuarios', detail: 'Falta ACCESS_USERS_FILE en el servidor' }];
    if (!label || label.length > 40) return [400, { error: 'invalido', detail: 'El token necesita un nombre de hasta 40 caracteres' }];
    const token = newToken();
    try {
      const record = store.addToken(userId, hashToken(token), { label, createdBy });
      return [201, { token, commands: commands(token), record, aviso: 'Se muestra una sola vez; solo se guarda su hash.' }];
    } catch (e) {
      if (e.message === 'limite_de_tokens') return [409, { error: 'limite_de_tokens', detail: `Maximo ${TOKEN_LIMIT} tokens activos por persona` }];
      if (e.message === 'no_existe') return [404, { error: 'no_existe' }];
      throw e;
    }
  }
  /** Revoca un token del portal y corta sus conexiones. Devuelve [status, cuerpo]. */
  function revokeTokenById(tid, by) {
    if (!store.writable) return [503, { error: 'sin_archivo_de_usuarios' }];
    const r = store.revokeToken(tid);
    if (r.error === 'no_existe') return [404, { error: 'no_existe' }];
    if (r.error) return [409, { error: r.error, detail: 'Ese token se quita en Coolify (ACCESS_DEVS / ACCESS_ADMINS)' }];
    const cut = closeSessions(r.userId, tid);
    log({ t: new Date().toISOString(), ev: 'admin_action', by, action: 'revocar_token', target: r.userId, tid, sesiones_cerradas: cut });
    return [200, { ok: true, sesiones_cerradas: cut }];
  }
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
      if (p === '/api/me/tokens' && req.method === 'GET') return send(200, { tokens: store.tokensOf(actor.id) });
      if (p === '/api/me/tokens' && req.method === 'POST') {
        // Con un Bearer de alguien que no es admin no se crean mas tokens: un token robado no puede perpetuarse.
        if (ctx.via !== 'cookie' && actor.role !== 'admin') return send(403, { error: 'requiere_sesion_del_portal' });
        const [status, body] = issueToken(actor.id, labelOf(await readJson(req)), actor.id);
        if (status === 201) audit('crear_token', actor.id, { tid: body.record.tid });
        return send(status, body);
      }
      const mine = /^\/api\/me\/tokens\/([A-Za-z0-9:_.-]+)$/.exec(p);
      if (mine && req.method === 'DELETE') {
        const tid = decodeURIComponent(mine[1]);
        if (!store.tokensOf(actor.id).some((t) => t.tid === tid)) return send(404, { error: 'no_existe' });
        const [status, body] = revokeTokenById(tid, actor.id);
        return send(status, body);
      }

      if (viewer && (await viewer.handle(req, res, url, actor))) return;

      if (!p.startsWith('/api/admin/')) return send(404, { error: 'not_found' });
      if (actor.role !== 'admin') { audit('denegado', p); return send(403, { error: 'forbidden', reason: 'solo_admin' }); }
      if (!store.writable) return send(503, { error: 'sin_archivo_de_usuarios', detail: 'Falta ACCESS_USERS_FILE en el servidor' });

      if (p === '/api/admin/users' && req.method === 'GET') {
        return send(200, { users: store.all().map((u) => publicUser(u, auth, store.tokensOf(u.id))).sort((a, b) => a.id.localeCompare(b.id)) });
      }
      if (p === '/api/admin/tokens' && req.method === 'GET') return send(200, { tokens: store.allTokens() });
      const adminToken = /^\/api\/admin\/tokens\/([A-Za-z0-9:_.-]+)$/.exec(p);
      if (adminToken && req.method === 'DELETE') {
        const [status, body] = revokeTokenById(decodeURIComponent(adminToken[1]), actor.id);
        return send(status, body);
      }

      if (p === '/api/admin/users' && req.method === 'POST') {
        const b = await readJson(req);
        const rec = { id: b.id, role: b.role, spaces: b.spaces ?? [] };
        const err = validateUser(rec);
        if (err) return send(400, { error: 'invalido', detail: err });
        if (exists(rec.id)) return send(409, { error: 'ya_existe' });
        const token = newToken();
        store.createFileUser(rec, hashToken(token), { label: 'Token inicial', createdBy: actor.id });
        audit('alta', rec.id, { role: rec.role, spaces: rec.spaces });
        return send(201, { user: { id: rec.id, role: rec.role, spaces: rec.spaces }, token, commands: commands(token), invite: inviteInfo(rec.id),
          aviso: 'El token del MCP y la invitacion al portal se muestran una sola vez y no se guardan en claro.' });
      }

      const m = /^\/api\/admin\/users\/([^/]+?)(\/invite|\/adopt|\/tokens|\/tokens\/revoke-all)?$/.exec(p);
      if (!m) return send(404, { error: 'not_found' });
      const id = decodeURIComponent(m[1]);
      if (!ID_RE.test(id)) return send(400, { error: 'id_invalido' });
      const target = store.all().find((u) => u.id === id);
      if (!target) return send(404, { error: 'no_existe' });

      if (m[2] === '/invite' && req.method === 'POST') { // alta de acceso al portal o restablecer contrasena
        audit('invitacion', id);
        return send(200, { id, invite: inviteInfo(id), aviso: 'Se muestra una sola vez; sustituye a la invitacion anterior.' });
      }

      if (m[2] === '/tokens' && req.method === 'GET') return send(200, { tokens: store.tokensOf(id) });
      if (m[2] === '/tokens' && req.method === 'POST') {
        const [status, body] = issueToken(id, labelOf(await readJson(req)), actor.id);
        if (status === 201) audit('crear_token', id, { tid: body.record.tid });
        return send(status, body);
      }
      if (m[2] === '/tokens/revoke-all' && req.method === 'POST') {
        const n = store.revokeUserTokens(id);
        const cut = closeSessions(id);
        audit('revocar_todos', id, { tokens: n, sesiones_cerradas: cut });
        return send(200, { ok: true, revocados: n, sesiones_cerradas: cut });
      }
      if (m[2] === '/adopt' && req.method === 'POST') {
        if (target.origin !== 'env') return send(409, { error: 'no_aplica', detail: 'Solo se migran las personas de ACCESS_DEVS' });
        store.adoptEnvUser(id);
        audit('migrar_al_portal', id);
        return send(200, { ok: true, aviso: 'Ya se gestiona desde el portal. Puedes quitar su linea de ACCESS_DEVS en Coolify.' });
      }

      if (target.origin !== 'file') return send(409, { error: 'gestionado_por_variable_de_entorno', detail: 'Se cambia en Coolify (ACCESS_DEVS / ACCESS_ADMINS) o migrala al portal' });
      const list = store.fileUsers();
      const idx = list.findIndex((u) => u.id === id);
      if (idx < 0) return send(404, { error: 'no_existe' });

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
        return send(200, { user: publicUser({ ...next, origin: 'file' }, auth, store.tokensOf(id)), sesiones_cerradas: cut });
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
