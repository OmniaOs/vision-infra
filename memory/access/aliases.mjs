// Alias de namespaces de Mem0 gestionados desde el portal (sin redeploy ni variables de entorno).
// Los de ACCESS_NAMESPACE_ALIASES (Coolify) se siguen respetando pero no se editan aqui; los del archivo si.
// Archivo: { version: 1, aliases: { "<namespace antiguo>": "<espacio>" } }

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { configureNamespaceAliases, parseNamespaceAliases } from './policy.mjs';

const toText = (entries) => entries.map(([ns, space]) => `${ns}=${space}`).join(',');

export function createAliasStore({ file, envText = '', log = () => {} } = {}) {
  const env = new Map(parseNamespaceAliases(envText));
  let mine = new Map();
  if (file && existsSync(file)) {
    try { mine = new Map(Object.entries(JSON.parse(readFileSync(file, 'utf8')).aliases || {})); } catch (e) { log({ ev: 'alias_archivo_roto', error: String(e.message).slice(0, 100) }); }
  }
  const all = (m = mine) => [...env, ...m];
  const apply = (m) => configureNamespaceAliases(toText(all(m)));
  try { apply(mine); } catch (e) { log({ ev: 'alias_archivo_invalido', error: String(e.message).slice(0, 100) }); mine = new Map(); apply(mine); }

  function save(next) {
    apply(next); // lanza antes de tocar nada si es invalido; el estado anterior sigue aplicado
    if (file) {
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ version: 1, aliases: Object.fromEntries(next) }, null, 2));
      renameSync(tmp, file);
    }
    mine = next;
  }

  const guard = (fn) => { try { return fn(); } catch (e) { try { apply(mine); } catch { /* ya estaba valido */ } throw e; } };

  return {
    get writable() { return Boolean(file); },
    list: () => [...env].map(([namespace, space]) => ({ namespace, space, origin: 'env' })).concat([...mine].map(([namespace, space]) => ({ namespace, space, origin: 'file' }))),
    /** Asigna o reasigna un namespace antiguo a un espacio. Devuelve el espacio anterior (o null). */
    set(namespace, space) {
      if (env.has(namespace)) throw new Error('alias_de_coolify');
      const previous = mine.get(namespace) ?? null;
      const next = new Map(mine); next.set(namespace, space);
      guard(() => save(next));
      return previous;
    },
    remove(namespace) {
      if (env.has(namespace)) throw new Error('alias_de_coolify');
      if (!mine.has(namespace)) throw new Error('no_existe');
      const previous = mine.get(namespace);
      const next = new Map(mine); next.delete(namespace);
      guard(() => save(next));
      return previous;
    },
  };
}
