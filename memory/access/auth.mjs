// Acceso al portal: contrasenas, invitaciones de un solo uso y sesiones por cookie.
// Separado del token del MCP a proposito: un token robado no abre el portal ni al reves.
//
// - Contrasenas con scrypt (viene en Node), con sal propia. Nunca se guardan ni se registran.
// - Invitacion: enlace de un solo uso, 24 h; la persona ELIGE su contrasena, nadie mas la conoce.
//   El hash del enlace se guarda, no el enlace.
// - Sesion: cookie HttpOnly + SameSite=Strict con un identificador aleatorio de 256 bits; en el
//   servidor solo queda su hash. Caduca por inactividad y por antiguedad. Vive en memoria: un
//   redeploy cierra las sesiones y hay que volver a entrar.
// - Cada peticion con cookie re-lee a la persona del almacen: un cambio de rol o una baja
//   se aplican al instante.
// - El segundo factor (TOTP) queda como ampliacion: ver memory/PERMISOS.md.

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const P = { N: 32768, r: 8, p: 1 };
const MAXMEM = 128 * 1024 * 1024;

export const COOKIE = 'omnia_sid';

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64, { ...P, maxmem: MAXMEM });
  return `scrypt$${P.N}$${P.r}$${P.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const m = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(stored || '');
  if (!m) return false;
  const [N, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (N > 2 ** 17 || r > 16 || p > 4) return false; // no gastar memoria por un archivo manipulado
  const salt = Buffer.from(m[4], 'base64');
  const want = Buffer.from(m[5], 'base64');
  const got = await scryptAsync(pw, salt, want.length, { N, r, p, maxmem: MAXMEM });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Devuelve un texto con el problema o null si la contrasena es aceptable. */
export function passwordProblem(pw, id = '') {
  if (typeof pw !== 'string') return 'La contrasena debe ser texto';
  if (pw.length < 12) return 'La contrasena debe tener al menos 12 caracteres';
  if (pw.length > 128) return 'La contrasena no puede pasar de 128 caracteres';
  if (id && pw.toLowerCase().includes(String(id).toLowerCase())) return 'La contrasena no puede contener tu usuario';
  if (new Set(pw).size < 5) return 'La contrasena es demasiado repetitiva';
  return null;
}

const DUMMY = hashPassword('contrasena-ficticia-para-igualar-tiempos');

export function createAuth({
  file, now = () => Date.now(), idleMs = 4 * 3600e3, absoluteMs = 12 * 3600e3, inviteMs = 24 * 3600e3,
  secureCookie = true, maxFails = 5, lockMs = 15 * 60e3,
} = {}) {
  let data = { creds: {}, invites: {} }; // creds: id -> {pw, updatedAt}; invites: sha(token) -> {id, exp}
  if (file && existsSync(file)) {
    try { data = { creds: {}, invites: {}, ...JSON.parse(readFileSync(file, 'utf8')) }; } catch { /* archivo ilegible: se parte de cero */ }
  }
  const sessions = new Map(); // sha(sid) -> {id, created, last, csrf}
  const fails = new Map(); // "ip|id" y "id" -> {n, until}

  function save() {
    if (!file) return;
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file);
  }

  const failKey = (ip, id) => [`${ip}|${id}`, `*|${id}`];
  const locked = (ip, id) => failKey(ip, id).some((k) => { const f = fails.get(k); return f && f.until > now(); });
  function noteFail(ip, id) {
    for (const [k, limit] of [[`${ip}|${id}`, maxFails], [`*|${id}`, maxFails * 6]]) {
      const f = fails.get(k) || { n: 0, until: 0 };
      if (f.until && f.until <= now()) { f.n = 0; f.until = 0; }
      f.n++;
      if (f.n >= limit) f.until = now() + lockMs;
      fails.set(k, f);
    }
  }

  function startSession(id) {
    const sid = randomBytes(32).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    sessions.set(sha(sid), { id, created: now(), last: now(), csrf });
    return { sid, csrf };
  }

  return {
    hasPassword: (id) => Boolean(data.creds[id]),

    /** Invitacion de un solo uso (sirve tambien para restablecer). Sustituye a la anterior. */
    createInvite(id) {
      for (const [h, v] of Object.entries(data.invites)) if (v.id === id) delete data.invites[h];
      const token = randomBytes(24).toString('base64url');
      data.invites[sha(token)] = { id, exp: now() + inviteMs };
      save();
      return { token, expiresAt: new Date(now() + inviteMs).toISOString() };
    },

    /** Canjea una invitacion y fija la contrasena. `exists(id)` confirma que la persona sigue dada de alta. */
    async acceptInvite(token, password, exists) {
      const h = sha(String(token || ''));
      const inv = data.invites[h];
      if (!inv || inv.exp <= now() || !exists(inv.id)) return { ok: false, reason: 'invitacion_invalida' };
      const problem = passwordProblem(password, inv.id);
      if (problem) return { ok: false, reason: 'contrasena_debil', detail: problem };
      const pw = await hashPassword(password);
      delete data.invites[h]; // un solo uso
      data.creds[inv.id] = { pw, updatedAt: new Date(now()).toISOString() };
      save();
      this.closeFor(inv.id);
      return { ok: true, id: inv.id };
    },

    /** Entrada con usuario y contrasena. Mismo mensaje y tiempo si la persona no existe. */
    async login(id, password, ip, exists) {
      if (typeof id !== 'string' || typeof password !== 'string' || password.length > 1024) return { ok: false, reason: 'credenciales' };
      if (locked(ip, id)) return { ok: false, reason: 'bloqueado' };
      const cred = data.creds[id];
      const good = await verifyPassword(password, cred ? cred.pw : await DUMMY);
      if (!cred || !good || !exists(id)) { noteFail(ip, id); return { ok: false, reason: 'credenciales' }; }
      for (const k of failKey(ip, id)) fails.delete(k);
      return { ok: true, id, ...startSession(id) };
    },

    /** Persona de la sesion que lleva esta cabecera Cookie, o null. */
    session(cookieHeader) {
      const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,80})`).exec(cookieHeader || '');
      if (!m) return null;
      const key = sha(m[1]);
      const s = sessions.get(key);
      if (!s) return null;
      if (now() - s.last > idleMs || now() - s.created > absoluteMs) { sessions.delete(key); return null; }
      s.last = now();
      return { key, id: s.id, csrf: s.csrf };
    },

    csrfOk(session, header) {
      const a = Buffer.from(String(header || ''));
      const b = Buffer.from(session.csrf);
      return a.length === b.length && timingSafeEqual(a, b);
    },

    logout(key) { sessions.delete(key); },
    closeFor(id, except) { let n = 0; for (const [k, s] of sessions) if (s.id === id && k !== except) { sessions.delete(k); n++; } return n; },

    /** Cambio de contrasena por la propia persona; cierra el resto de sus sesiones. */
    async changePassword(id, current, next, exceptKey) {
      const cred = data.creds[id];
      if (!cred || !(await verifyPassword(String(current), cred.pw))) return { ok: false, reason: 'contrasena_actual_incorrecta' };
      const problem = passwordProblem(next, id);
      if (problem) return { ok: false, reason: 'contrasena_debil', detail: problem };
      data.creds[id] = { pw: await hashPassword(next), updatedAt: new Date(now()).toISOString() };
      save();
      return { ok: true, cerradas: this.closeFor(id, exceptKey) };
    },

    /** Baja: se borra todo rastro de acceso al portal de esa persona. */
    removeUser(id) {
      delete data.creds[id];
      for (const [h, v] of Object.entries(data.invites)) if (v.id === id) delete data.invites[h];
      save();
      return this.closeFor(id);
    },

    cookie(sid) {
      return `${COOKIE}=${sid}; HttpOnly; ${secureCookie ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${Math.floor(absoluteMs / 1000)}`;
    },
    clearCookie() { return `${COOKIE}=; HttpOnly; ${secureCookie ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`; },
    sessionCount: () => sessions.size,
  };
}
