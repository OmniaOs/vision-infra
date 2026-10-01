// API del panel de administracion (memorypanel.<dominio>). Mismo origen que las paginas:
// no hay CORS. Autenticacion con el mismo token de cada persona (Bearer).
//
//   GET    /api/me                          cualquier rol
//   GET    /api/admin/users                 admin
//   POST   /api/admin/users                 admin   {id, role, spaces}  -> devuelve el token UNA vez
//   PATCH  /api/admin/users/:id             admin   {role?, spaces?}
//   POST   /api/admin/users/:id/rotate      admin   -> token nuevo, corta las sesiones de esa persona
//   DELETE /api/admin/users/:id             admin   -> baja inmediata
//
// Solo se gestionan las personas del archivo de usuarios. Las de ACCESS_DEVS / ACCESS_ADMINS son de
// solo lectura aqui: se cambian en Coolify.

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

const publicUser = (u) => ({
  id: u.id, role: u.role, spaces: u.spaces, origin: u.origin || 'env', editable: u.origin === 'file',
  createdAt: u.createdAt || null,
});

export function createPanelApi({ store, closeSessions, log = () => {}, memoryDomain = 'memory.omniaos.ai' }) {
  const newToken = () => `omnia_${randomBytes(32).toString('base64url')}`;
  const commands = (token) => ({
    windows: `$env:OMNIA_TOKEN='${token}'; irm https://${memoryDomain}/setup | iex`,
    unix: `OMNIA_TOKEN='${token}' bash -c "$(curl -fsSL https://${memoryDomain}/setup.sh)"`,
  });

  /** Devuelve true si la peticion era de la API (y ya se respondio). */
  async function handle(req, res, url, actor) {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    const p = url.pathname;
    const audit = (action, target, extra = {}) => log({ t: new Date().toISOString(), ev: 'admin_action', by: actor.id, action, target, ...extra });

    try {
      if (p === '/api/me' && req.method === 'GET') {
        return send(200, { id: actor.id, role: actor.role, spaces: actor.spaces });
      }
      if (!p.startsWith('/api/admin/')) return send(404, { error: 'not_found' });
      if (actor.role !== 'admin') { audit('denegado', p); return send(403, { error: 'forbidden', reason: 'solo_admin' }); }
      if (!store.writable) return send(503, { error: 'sin_archivo_de_usuarios', detail: 'Falta ACCESS_USERS_FILE en el servidor' });

      if (p === '/api/admin/users' && req.method === 'GET') {
        return send(200, { users: store.all().map(publicUser).sort((a, b) => a.id.localeCompare(b.id)) });
      }

      if (p === '/api/admin/users' && req.method === 'POST') {
        const b = await readJson(req);
        const rec = { id: b.id, role: b.role, spaces: b.spaces ?? [] };
        const err = validateUser(rec);
        if (err) return send(400, { error: 'invalido', detail: err });
        if (store.all().some((u) => u.id === rec.id)) return send(409, { error: 'ya_existe' });
        const token = newToken();
        store.setFileUsers([...store.fileUsers(), { ...rec, hash: hashToken(token), active: true, createdAt: new Date().toISOString() }]);
        audit('alta', rec.id, { role: rec.role, spaces: rec.spaces });
        return send(201, { user: { id: rec.id, role: rec.role, spaces: rec.spaces }, token, commands: commands(token),
          aviso: 'El token se muestra una sola vez y no se guarda en claro.' });
      }

      const m = /^\/api\/admin\/users\/([^/]+?)(\/rotate)?$/.exec(p);
      if (!m) return send(404, { error: 'not_found' });
      const id = decodeURIComponent(m[1]);
      if (!ID_RE.test(id)) return send(400, { error: 'id_invalido' });
      const target = store.all().find((u) => u.id === id);
      if (!target) return send(404, { error: 'no_existe' });
      if (target.origin !== 'file') return send(409, { error: 'gestionado_por_variable_de_entorno', detail: 'Se cambia en Coolify (ACCESS_DEVS / ACCESS_ADMINS)' });
      const list = store.fileUsers();
      const idx = list.findIndex((u) => u.id === id);
      if (idx < 0) return send(404, { error: 'no_existe' });

      if (m[2] && req.method === 'POST') { // rotar token
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
        const cut = closeSessions(id); // los permisos nuevos se aplican en sesiones nuevas
        audit('cambio', id, { role: next.role, spaces: next.spaces, sesiones_cerradas: cut });
        return send(200, { user: publicUser({ ...next, origin: 'file' }), sesiones_cerradas: cut });
      }

      if (req.method === 'DELETE') {
        if (id === actor.id) return send(409, { error: 'no_puedes_darte_de_baja_a_ti_mismo' });
        list.splice(idx, 1);
        store.setFileUsers(list);
        const cut = closeSessions(id);
        audit('baja', id, { sesiones_cerradas: cut });
        return send(200, { ok: true, sesiones_cerradas: cut });
      }
      return send(405, { error: 'method_not_allowed' });
    } catch (e) {
      if (e.status) return send(e.status, { error: e.message });
      log({ t: new Date().toISOString(), ev: 'panel_error', error: String(e.message).slice(0, 160) });
      return send(500, { error: 'interno' });
    }
  }

  return { handle };
}
