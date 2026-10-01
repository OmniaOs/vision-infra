// Almacen de usuarios del gateway: roles y espacios por token.
//
// Fuentes, de menor a mayor prioridad:
//   1. ACCESS_DEVS   "id:hash[:rol[:espacio+espacio]]"  (formato antiguo "id:hash" sigue valiendo)
//   2. archivo JSON  {version, users:[{id, hash, role, spaces, active}]}  (se relee solo si cambia)
//   3. ACCESS_ADMINS "id:hash"  siempre admin: acceso de emergencia, no se edita desde el panel
//
// Un token se guarda solo como hash SHA-256 (el token tiene 256 bits de entropia).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { validateUser } from './policy.mjs';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const LINE = /^([a-z0-9][a-z0-9._-]{0,31}):([0-9a-f]{64})(?::([a-z]+)(?::([a-z0-9+-]*))?)?$/;

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

/** Escribe el archivo de usuarios de forma atomica. */
export function saveUsersFile(file, users) {
  const clean = users.map(({ id, hash, role, spaces, active, createdAt }) => ({ id, hash, role, spaces, active: active !== false, createdAt }));
  for (const u of clean) {
    const err = validateUser(u);
    if (err) throw new Error(`${u.id}: ${err}`);
  }
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, users: clean }, null, 2));
  renameSync(tmp, file);
}

export function createStore({ envText = '', adminsText = '', file, log = () => {} } = {}) {
  let byHash = new Map();
  let mtime = -1;
  let lastCheck = 0;

  function build() {
    const next = new Map();
    const put = (u) => {
      for (const [h, v] of next) if (v.id === u.id) next.delete(h);
      next.set(u.hash, u);
    };
    for (const u of parseUsers(envText)) put(u);
    if (file && existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      for (const u of data.users || []) {
        const err = validateUser(u);
        if (err) throw new Error(`archivo de usuarios: ${u && u.id}: ${err}`);
        if (u.active !== false) put({ ...u, active: true });
        else for (const [h, v] of next) if (v.id === u.id) next.delete(h);
      }
      mtime = statSync(file).mtimeMs;
    } else {
      mtime = -1; // sin archivo: que refresh() no reconstruya cada segundo
    }
    for (const u of parseUsers(adminsText, { forceRole: 'admin' })) put(u);
    return next;
  }

  byHash = build();

  /** Relee el archivo si cambio (a lo sumo una comprobacion por segundo). */
  function refresh(now = Date.now()) {
    if (!file || now - lastCheck < 1000) return;
    lastCheck = now;
    try {
      const m = existsSync(file) ? statSync(file).mtimeMs : -1;
      if (m !== mtime) { byHash = build(); log({ ev: 'usuarios_recargados', n: byHash.size }); }
    } catch (e) {
      log({ ev: 'usuarios_error_recarga', error: String(e.message).slice(0, 120) }); // se conserva el estado anterior
    }
  }

  return {
    lookup(hash) { refresh(); return byHash.get(hash) || null; },
    all() { refresh(); return [...byHash.values()]; },
    get size() { return byHash.size; },
    refresh,
  };
}

/** Compatibilidad: un Map(hash -> id) antiguo se trata como admins (sin restricciones). */
export function storeFromLegacy(devs) {
  const m = new Map([...devs].map(([hash, id]) => [hash, { id, hash, role: 'admin', spaces: [], active: true }]));
  return { lookup: (h) => m.get(h) || null, all: () => [...m.values()], get size() { return m.size; }, refresh() {} };
}
