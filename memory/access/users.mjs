// Almacen de personas y tokens del gateway.
//
// PERSONAS (rol y espacios), de menor a mayor prioridad:
//   1. ACCESS_DEVS   "id:hash[:rol[:espacio+espacio]]"  (formato antiguo "id:hash" sigue valiendo)
//   2. archivo JSON  (se gestiona desde el portal; se relee solo si cambia)
//   3. ACCESS_ADMINS "id:hash"  siempre admin: acceso de emergencia, no se edita desde el portal
//
// TOKENS: una persona puede tener varios. Los de Coolify (1 y 3) se ven pero no se revocan aqui;
// los del archivo se crean y revocan desde el portal y guardan nombre, fecha y ultimo uso.
// Un token se guarda solo como hash SHA-256 (el token tiene 256 bits de entropia).
//
// Archivo v2: { version: 2, users: [{id, role, spaces, active, createdAt}],
//               tokens: [{tid, userId, hash, label, createdAt, createdBy, lastUsedAt, lastIp, lastDevice, revokedAt}] }
// El v1 (un `hash` por persona) se migra solo al leerlo.

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { validateUser } from './policy.mjs';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export const TOKEN_LIMIT = 20; // tokens activos por persona
const REVOKED_KEEP_MS = 90 * 24 * 3600 * 1000; // los revocados se conservan 90 dias como historial
const USAGE_FLUSH_MS = 30000;
const LINE = /^([a-z0-9][a-z0-9._-]{0,31}):([0-9a-f]{64})(?::([a-z]+)(?::([a-z0-9+-]*))?)?$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const newTid = () => `t_${randomBytes(6).toString('hex')}`;
const clip = (v, n) => (v == null ? null : String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) || null);

/** Texto de ACCESS_DEVS / ACCESS_ADMINS -> lista de usuarios validados. */
export function parseUsers(text, { defaultRole = 'miembro', forceRole } = {}) {
  const out = [];
  for (const raw of String(text || '').split(/[\n,]+/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = LINE.exec(line);
    if (!m) throw new Error(`usuarios: linea invalida (esperaba id:sha256hex[:rol[:espacios]]): "${line.slice(0, 40)}"`);
    const user = {
      id: m[1], hash: m[2], role: forceRole || m[3] || defaultRole,
      spaces: m[4] ? m[4].split('+').filter(Boolean) : [], active: true,
    };
    const err = validateUser(user);
    if (err) throw new Error(`usuarios: ${user.id}: ${err}`);
    out.push(user);
  }
  return out;
}

/** Valida y escribe el archivo (v2) de forma atomica. Descarta revocados con mas de 90 dias. */
export function saveStoreFile(file, { users, tokens = [] }, now = Date.now()) {
  const cleanUsers = users.map(({ id, role, spaces, active, createdAt }) => ({ id, role, spaces, active: active !== false, createdAt }));
  for (const u of cleanUsers) {
    const err = validateUser(u);
    if (err) throw new Error(`${u.id}: ${err}`);
  }
  const ids = new Set(cleanUsers.map((u) => u.id));
  const keep = tokens.filter((t) => ids.has(t.userId) && !(t.revokedAt && now - Date.parse(t.revokedAt) > REVOKED_KEEP_MS));
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 2, users: cleanUsers, tokens: keep }, null, 2));
  renameSync(tmp, file);
}

/** Lee el archivo (v1 o v2) y lo normaliza a { users, tokens }. Lanza si algo no es valido. */
function readStoreFile(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const users = []; const tokens = [];
  for (const u of raw.users || []) {
    const err = validateUser(u);
    if (err) throw new Error(`archivo de usuarios: ${u && u.id}: ${err}`);
    users.push({ id: u.id, role: u.role, spaces: u.spaces, active: u.active !== false, createdAt: u.createdAt });
    if (u.hash) { // v1: un token por persona
      if (!HASH_RE.test(u.hash)) throw new Error(`archivo de usuarios: hash invalido de ${u.id}`);
      tokens.push({ tid: `t_${u.hash.slice(0, 12)}`, userId: u.id, hash: u.hash, label: 'Token inicial', createdAt: u.createdAt || null });
    }
  }
  for (const t of raw.tokens || []) {
    if (!t || !HASH_RE.test(t.hash) || !t.tid || !t.userId) throw new Error('archivo de usuarios: token invalido');
    tokens.push({ ...t });
  }
  return { users, tokens };
}

const publicToken = (t, usage) => {
  const u = t.origin === 'file' ? t : { ...t, ...(usage.get(t.tid) || {}) };
  return {
    tid: t.tid, userId: t.userId, label: t.label, origin: t.origin, managed: t.origin === 'file',
    createdAt: t.createdAt || null, createdBy: t.createdBy || null,
    lastUsedAt: u.lastUsedAt || null, lastIp: u.lastIp || null, lastDevice: u.lastDevice || null, revokedAt: t.revokedAt || null,
  };
};

export function createStore({ envText = '', adminsText = '', file, log = () => {}, now = () => Date.now() } = {}) {
  let people = new Map(); // id -> persona
  let creds = new Map(); // hash -> credencial ACTIVA
  let revoked = []; // credenciales del archivo ya revocadas (historial)
  let data = { users: [], tokens: [] }; // contenido del archivo
  const usage = new Map(); // tid -> ultimo uso de tokens de Coolify (solo en memoria)
  let mtime = -1;
  let lastCheck = 0;
  let dirty = false;
  let timer = null;

  function build() {
    const p = new Map(); const c = new Map(); const rev = [];
    const addCred = (cred) => { c.set(cred.hash, cred); };
    for (const u of parseUsers(envText)) {
      p.set(u.id, { id: u.id, role: u.role, spaces: u.spaces, origin: 'env', createdAt: null });
      addCred({ tid: `env:${u.id}`, userId: u.id, hash: u.hash, label: 'Definido en Coolify', origin: 'env' });
    }
    if (file && existsSync(file)) {
      data = readStoreFile(file);
      for (const u of data.users) {
        if (!u.active) { // baja explicita: tambien corta los tokens de Coolify de esa persona
          p.delete(u.id);
          for (const [h, v] of c) if (v.userId === u.id) c.delete(h);
          continue;
        }
        p.set(u.id, { id: u.id, role: u.role, spaces: u.spaces, origin: 'file', createdAt: u.createdAt || null });
      }
      for (const t of data.tokens) {
        if (!p.has(t.userId)) continue;
        const cred = { ...t, origin: 'file' };
        if (t.revokedAt) rev.push(cred); else addCred(cred);
      }
      mtime = statSync(file).mtimeMs;
    } else {
      data = { users: [], tokens: [] };
      mtime = -1; // sin archivo: que refresh() no reconstruya cada segundo
    }
    for (const u of parseUsers(adminsText, { forceRole: 'admin' })) {
      const prev = p.get(u.id);
      p.set(u.id, { id: u.id, role: 'admin', spaces: [], origin: 'admins', createdAt: prev ? prev.createdAt : null });
      addCred({ tid: `admins:${u.id}`, userId: u.id, hash: u.hash, label: 'Acceso de emergencia (Coolify)', origin: 'admins' });
    }
    people = p; creds = c; revoked = rev;
  }
  build();

  /** Relee el archivo si cambio (a lo sumo una comprobacion por segundo). */
  function refresh(t = Date.now()) {
    if (!file || t - lastCheck < 1000) return;
    lastCheck = t;
    try {
      const m = existsSync(file) ? statSync(file).mtimeMs : -1;
      if (m !== mtime) { build(); log({ ev: 'usuarios_recargados', n: people.size }); }
    } catch (e) {
      log({ ev: 'usuarios_error_recarga', error: String(e.message).slice(0, 120) }); // se conserva el estado anterior
    }
  }

  /** Escribe el archivo y reconstruye. Lanza si algo no es valido (el estado anterior se conserva). */
  function commit(next) {
    if (!file) throw new Error('sin_archivo_de_usuarios');
    saveStoreFile(file, next, now());
    build();
    lastCheck = Date.now();
    dirty = false;
  }

  const person = (id) => people.get(id) || null;
  const view = (p) => (p ? { ...p, spaces: [...p.spaces] } : null);

  function fileTokens(userId) {
    return data.tokens.filter((t) => t.userId === userId);
  }
  const activeFileTokens = (userId) => fileTokens(userId).filter((t) => !t.revokedAt);

  function flushUsage() {
    timer = null;
    if (!dirty || !file) return;
    try { commit({ users: data.users, tokens: data.tokens }); } catch (e) { log({ ev: 'usuarios_error_guardado_uso', error: String(e.message).slice(0, 120) }); }
  }

  return {
    lookup(hash) {
      refresh();
      const c = creds.get(hash);
      const p = c && person(c.userId);
      return p ? { ...view(p), hash, tokenId: c.tid } : null;
    },
    byId(id) { refresh(); return view(person(id)); },
    all() { refresh(); return [...people.values()].map(view); },
    get size() { return people.size; },
    get writable() { return Boolean(file); },
    refresh,

    // ---- personas del archivo (las que se gestionan desde el portal) ----
    fileUsers() { return data.users.filter((u) => u.active).map((u) => ({ ...u, spaces: [...u.spaces] })); },
    /** Reemplaza las personas del archivo. Quien ya no esta pierde tambien sus tokens. */
    setFileUsers(list) { commit({ users: list, tokens: data.tokens }); },
    /** Alta: la persona y su primer token en una sola escritura. */
    createFileUser(rec, hash, { label = 'Token inicial', createdBy = null } = {}) {
      const createdAt = new Date(now()).toISOString();
      const token = { tid: newTid(), userId: rec.id, hash, label: clip(label, 40) || 'Token inicial', createdAt, createdBy };
      commit({ users: [...this.fileUsers(), { ...rec, active: true, createdAt }], tokens: [...data.tokens, token] });
      return publicToken({ ...token, origin: 'file' }, usage);
    },
    /** Pasa una persona de ACCESS_DEVS al portal, conservando su mismo token. */
    adoptEnvUser(id) {
      const p = person(id);
      if (!p || p.origin !== 'env') return false;
      const c = [...creds.values()].find((x) => x.userId === id && x.origin === 'env');
      const createdAt = new Date(now()).toISOString();
      const tokens = [...data.tokens];
      if (c) tokens.push({ tid: newTid(), userId: id, hash: c.hash, label: 'Migrado desde Coolify', createdAt, ...(usage.get(c.tid) || {}) });
      commit({ users: [...this.fileUsers(), { id, role: p.role, spaces: p.spaces, active: true, createdAt }], tokens });
      return true;
    },

    // ---- tokens ----
    tokensOf(userId) {
      refresh();
      const mine = [...creds.values(), ...revoked].filter((c) => c.userId === userId);
      return mine.map((c) => publicToken(c, usage)).sort((a, b) => Number(Boolean(a.revokedAt)) - Number(Boolean(b.revokedAt))
        || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    },
    allTokens() {
      refresh();
      return [...people.keys()].flatMap((id) => this.tokensOf(id));
    },
    /** Crea un token del archivo. Lanza `limite_de_tokens` si ya hay TOKEN_LIMIT activos. */
    addToken(userId, hash, { label, createdBy = null } = {}) {
      if (!person(userId)) throw new Error('no_existe');
      if (activeFileTokens(userId).length >= TOKEN_LIMIT) throw new Error('limite_de_tokens');
      const token = { tid: newTid(), userId, hash, label: clip(label, 40) || 'Sin nombre', createdAt: new Date(now()).toISOString(), createdBy };
      // Una persona definida solo en Coolify tambien puede tener tokens del portal: se guarda su registro
      // (mismo rol y espacios). Desde ese momento se gestiona aqui; su token de Coolify sigue valiendo.
      const p = person(userId);
      const users = data.users.some((u) => u.id === userId)
        ? data.users
        : [...data.users, { id: userId, role: p.role, spaces: p.spaces, active: true, createdAt: token.createdAt }];
      commit({ users, tokens: [...data.tokens, token] });
      return publicToken({ ...token, origin: 'file' }, usage);
    },
    /** Revoca un token del archivo. Devuelve { userId } o { error }. */
    revokeToken(tid) {
      refresh();
      const t = data.tokens.find((x) => x.tid === tid);
      if (!t) return [...creds.values()].some((c) => c.tid === tid) ? { error: 'gestionado_en_coolify' } : { error: 'no_existe' };
      if (t.revokedAt) return { userId: t.userId, already: true };
      commit({ users: data.users, tokens: data.tokens.map((x) => (x.tid === tid ? { ...x, revokedAt: new Date(now()).toISOString() } : x)) });
      return { userId: t.userId };
    },
    /** Revoca todos los tokens del portal de una persona. Devuelve cuantos. */
    revokeUserTokens(userId) {
      const n = activeFileTokens(userId).length;
      if (!n) return 0;
      const at = new Date(now()).toISOString();
      commit({ users: data.users, tokens: data.tokens.map((x) => (x.userId === userId && !x.revokedAt ? { ...x, revokedAt: at } : x)) });
      return n;
    },
    /** Anota el ultimo uso de un token. Se guarda en disco como mucho cada 30 s. */
    touch(user, { ip, agent } = {}) {
      if (!user || !user.tokenId) return;
      const info = { lastUsedAt: new Date(now()).toISOString(), lastIp: clip(ip, 64), lastDevice: clip(agent, 80) };
      const t = data.tokens.find((x) => x.tid === user.tokenId);
      if (t) {
        Object.assign(t, info);
        const c = creds.get(t.hash); // la credencial activa es una copia: se mantiene al dia para el listado
        if (c) Object.assign(c, info);
        dirty = true;
        if (!timer) { timer = setTimeout(flushUsage, USAGE_FLUSH_MS); timer.unref?.(); }
      } else usage.set(user.tokenId, info);
    },
    flushUsage,
  };
}

/** Compatibilidad: un Map(hash -> id) antiguo se trata como admins (sin restricciones). */
export function storeFromLegacy(devs) {
  const m = new Map([...devs].map(([hash, id]) => [hash, { id, hash, role: 'admin', spaces: [], active: true }]));
  return {
    lookup: (h) => (m.has(h) ? { ...m.get(h), tokenId: `legacy:${m.get(h).id}` } : null),
    byId: (id) => [...m.values()].find((u) => u.id === id) || null,
    all: () => [...m.values()],
    get size() { return m.size; },
    writable: false,
    refresh() {}, touch() {}, tokensOf: () => [], allTokens: () => [],
  };
}
