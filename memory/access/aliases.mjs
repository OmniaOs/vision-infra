// Configuracion de acceso gestionada desde el portal (sin redeploy ni variables de entorno):
//   - alias de namespaces de Mem0 -> espacio            (kind 'mem0')
//   - alias de proyectos de Basic Memory -> espacio     (kind 'kb')
//   - modo de permisos: bloquear (enforce) o solo registrar
// Los de ACCESS_NAMESPACE_ALIASES / ACCESS_PROJECT_ALIASES / ACCESS_ENFORCE (Coolify) se respetan pero no se editan aqui.
// Archivo: { version: 2, mem0: { "<namespace>": "<espacio>" }, kb: { "<proyecto>": "<espacio>" }, enforce: false }
// (el formato v1 `{ aliases: {...} }` se lee como `mem0`).

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { configureKbAliases, configureNamespaceAliases, parseNamespaceAliases } from './policy.mjs';

const APPLY = { mem0: configureNamespaceAliases, kb: configureKbAliases };
const toText = (map) => [...map].map(([name, space]) => `${name}=${space}`).join(',');

export function createAliasStore({ file, envText = '', kbEnvText = '', enforceEnv = false, log = () => {} } = {}) {
  const env = { mem0: new Map(parseNamespaceAliases(envText)), kb: new Map(parseNamespaceAliases(kbEnvText)) };
  let mine = { mem0: new Map(), kb: new Map() };
  let enforce = false;

  if (file && existsSync(file)) {
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      mine = { mem0: new Map(Object.entries(raw.mem0 || raw.aliases || {})), kb: new Map(Object.entries(raw.kb || {})) };
      enforce = raw.enforce === true;
    } catch (e) { log({ ev: 'alias_archivo_roto', error: String(e.message).slice(0, 100) }); }
  }

  const apply = (state) => { for (const kind of Object.keys(APPLY)) APPLY[kind](toText(new Map([...env[kind], ...state[kind]]))); };
  try { apply(mine); } catch (e) { log({ ev: 'alias_archivo_invalido', error: String(e.message).slice(0, 100) }); mine = { mem0: new Map(), kb: new Map() }; apply(mine); }

  function persist() {
    if (!file) return;
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 2, mem0: Object.fromEntries(mine.mem0), kb: Object.fromEntries(mine.kb), enforce }, null, 2));
    renameSync(tmp, file);
  }

  /** Aplica `next` (lanza antes de tocar nada si es invalido), lo guarda y lo deja vigente. */
  function commit(next) {
    try { apply(next); } catch (e) { apply(mine); throw e; }
    const previous = mine;
    mine = next;
    try { persist(); } catch (e) { mine = previous; apply(mine); throw e; }
  }

  const need = (kind) => { if (!APPLY[kind]) throw new Error('tipo_invalido'); };

  return {
    get writable() { return Boolean(file); },
    list: (kind) => (need(kind), [...env[kind]].map(([name, space]) => ({ name, space, origin: 'env' })).concat([...mine[kind]].map(([name, space]) => ({ name, space, origin: 'file' })))),
    /** Asigna o reasigna. Devuelve el espacio anterior (o null). */
    set(kind, name, space) {
      need(kind);
      if (env[kind].has(name)) throw new Error('alias_de_coolify');
      const previous = mine[kind].get(name) ?? null;
      commit({ ...mine, [kind]: new Map(mine[kind]).set(name, space) });
      return previous;
    },
    remove(kind, name) {
      need(kind);
      if (env[kind].has(name)) throw new Error('alias_de_coolify');
      if (!mine[kind].has(name)) throw new Error('no_existe');
      const previous = mine[kind].get(name);
      const next = new Map(mine[kind]); next.delete(name);
      commit({ ...mine, [kind]: next });
      return previous;
    },
    /** Modo de permisos vigente: lo fuerza Coolify (ACCESS_ENFORCE=1) o lo decide el portal. */
    get enforce() { return enforceEnv || enforce; },
    get enforcedByEnv() { return Boolean(enforceEnv); },
    setEnforce(value) {
      if (enforceEnv) throw new Error('forzado_por_coolify');
      const previous = enforce;
      enforce = Boolean(value);
      try { persist(); } catch (e) { enforce = previous; throw e; }
    },
  };
}
