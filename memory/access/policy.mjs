// Motor de politicas del gateway: roles, espacios y reglas por herramienta.
// Funciones puras, sin red ni estado. Diseno y verificacion: memory/PERMISOS.md.
//
// Principio: LISTA BLANCA. Lo que no esta explicitamente permitido se deniega
// (herramientas desconocidas, argumentos de alcance, URLs memory:// de otro proyecto).

export const SPACE_RE = /^(global|(?:proy|int|cli)-[a-z0-9]+(?:-[a-z0-9]+)*)$/;
export const ROLES = ['admin', 'miembro', 'lectura', 'cliente'];

// Mem0: el espacio `global` vive en el namespace historico `omnia-global`. Los namespaces que ya tenian datos con
// un nombre antiguo (el slug de cada repo) se declaran como ALIAS de un espacio: el gateway los trata como ese
// espacio para los permisos y no hace falta mover ni reescribir ninguna memoria.
let toSpace = new Map(); // namespace antiguo -> espacio
let toNamespace = new Map(); // espacio -> namespace antiguo

/** Texto `antiguo=espacio,antiguo2=espacio2`. Lanza si algo no es valido (mejor no arrancar que abrir un hueco). */
export function configureNamespaceAliases(text) {
  const spaces = new Map(); const namespaces = new Map();
  for (const raw of String(text || '').split(/[\n,]+/)) {
    const entry = raw.trim();
    if (!entry || entry.startsWith('#')) continue;
    const [legacy, space, extra] = entry.split('=').map((x) => x.trim());
    if (extra !== undefined || !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(legacy || '')) throw new Error(`alias invalido: "${entry.slice(0, 40)}"`);
    if (!SPACE_RE.test(space || '') || space === 'global') throw new Error(`alias invalido: ${legacy} -> ${space} (el destino debe ser un espacio proy-/int-/cli-)`);
    if (legacy === 'omnia-global' || SPACE_RE.test(legacy)) throw new Error(`alias invalido: ${legacy} ya es un nombre de espacio`);
    if (spaces.has(legacy) || namespaces.has(space)) throw new Error(`alias repetido: ${legacy} / ${space}`);
    spaces.set(legacy, space); namespaces.set(space, legacy);
  }
  toSpace = spaces; toNamespace = namespaces;
}

export const mem0Namespace = (space) => (space === 'global' ? 'omnia-global' : toNamespace.get(space) ?? space);
export const spaceFromMem0 = (ns) => {
  if (ns === 'omnia-global') return 'global';
  if (toSpace.has(ns)) return toSpace.get(ns);
  // Un espacio con alias solo se alcanza por su nombre antiguo: usar el nuevo abriria un namespace vacio y aparte.
  return SPACE_RE.test(ns) && !toNamespace.has(ns) ? ns : null;
};
/** Basic Memory: el proyecto se llama igual que el espacio. */
export const spaceFromKbProject = (p) => (typeof p === 'string' && SPACE_RE.test(p) ? p : null);

const deny = (reason) => ({ ok: false, reason });
const ok = () => ({ ok: true });

/** Valida un registro de usuario. Devuelve null si es valido o un texto con el motivo. */
export function validateUser(u) {
  if (!u || typeof u !== 'object') return 'registro invalido';
  if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(u.id || '')) return 'id invalido';
  if (!ROLES.includes(u.role)) return `rol invalido: ${u.role}`;
  if (!Array.isArray(u.spaces)) return 'spaces debe ser una lista';
  for (const s of u.spaces) {
    if (!SPACE_RE.test(s)) return `espacio invalido: ${s}`;
    if (s === 'global') return 'global no se asigna: ya es implicito segun el rol';
    if (u.role === 'cliente' && !s.startsWith('cli-')) return `un cliente solo puede tener espacios cli-: ${s}`;
  }
  if (u.role === 'cliente' && u.spaces.length === 0) return 'un cliente necesita al menos un espacio cli-';
  return null;
}

/** Nivel de acceso de un usuario a un espacio: 'rw', 'r' o null. */
export function access(user, space) {
  if (!user || !space) return null;
  if (user.role === 'admin') return 'rw';
  const assigned = Array.isArray(user.spaces) && user.spaces.includes(space);
  switch (user.role) {
    case 'miembro': return space === 'global' || assigned ? 'rw' : null;
    case 'lectura': return space === 'global' || assigned ? 'r' : null;
    case 'cliente': return assigned && space.startsWith('cli-') ? 'rw' : null;
    default: return null;
  }
}

// ---------- JSON-RPC ----------

const SAFE_METHODS = new Set(['initialize', 'ping', 'tools/list', 'tools/call', 'resources/list', 'prompts/list']);

/** Parsea el cuerpo de un POST MCP. Devuelve { msgs } o { error }. */
export function parseRpc(raw) {
  let j;
  try { j = JSON.parse(raw); } catch { return { error: 'invalid_json' }; }
  const msgs = Array.isArray(j) ? j : [j];
  if (!msgs.length || msgs.length > 50 || msgs.some((m) => !m || typeof m !== 'object' || Array.isArray(m))) {
    return { error: 'invalid_rpc' };
  }
  return { msgs };
}

function methodAllowed(m, admin) {
  if (admin) return true;
  if (m.method === undefined) return 'result' in m || 'error' in m; // respuesta del cliente
  if (typeof m.method !== 'string') return false;
  return SAFE_METHODS.has(m.method) || m.method.startsWith('notifications/');
}

// ---------- Mem0 ----------

const MEM0_TOOLS = { add_memories: 'w', search_memory: 'r', list_memories: 'r', delete_all_memories: 'admin' };

/** Conexion SSE a un namespace de Mem0. */
export function checkMem0Connect(user, namespace) {
  if (user.role === 'admin') return ok();
  const space = spaceFromMem0(namespace);
  if (!space) return deny('namespace_desconocido');
  return access(user, space) ? ok() : deny('sin_acceso_al_espacio');
}

/** Mensajes de una sesion Mem0 ya asociada a `space`. */
export function checkMem0Rpc(user, space, msgs) {
  const admin = user.role === 'admin';
  for (const m of msgs) {
    if (!methodAllowed(m, admin)) return deny(`metodo_no_permitido:${String(m.method).slice(0, 40)}`);
    if (m.method !== 'tools/call') continue;
    const name = m.params && m.params.name;
    const need = MEM0_TOOLS[name];
    if (!need) return deny(`herramienta_no_permitida:${String(name).slice(0, 40)}`);
    if (admin) continue;
    const acc = access(user, space);
    if (!acc) return deny('sin_acceso_al_espacio');
    if (need === 'admin') return deny('solo_admin');
    if (need === 'w' && acc !== 'rw') return deny('solo_lectura');
  }
  return ok();
}

// ---------- Basic Memory ----------

const KB_READ = new Set(['search_notes', 'read_note', 'view_note', 'read_content', 'build_context',
  'recent_activity', 'list_directory', 'schema_validate', 'schema_infer', 'schema_diff']);
const KB_WRITE = new Set(['write_note', 'edit_note', 'move_note', 'delete_note']);
// Un cliente usa solo lo imprescindible para leer y escribir notas en SU proyecto. Quedan fuera las herramientas
// con mas caminos hacia otros proyectos (build_context y sus URLs memory://, move_note, read_content, schema_*, delete_note).
const KB_CLIENT_TOOLS = new Set(['search_notes', 'read_note', 'view_note', 'list_directory', 'recent_activity', 'write_note', 'edit_note']);
const KB_FORBIDDEN_KEYS = ['project_id', 'workspace'];

/** Herramientas de Basic Memory que el gateway deja pasar (lo demas se deniega). Lo usan las pruebas y la foto de versiones. */
export const KB_TOOLS = { read: KB_READ, write: KB_WRITE, client: KB_CLIENT_TOOLS };

/** Recorre todos los textos de un valor (profundidad acotada). */
function* strings(v, depth = 0) {
  if (depth > 6) return;
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* strings(x, depth + 1);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x, depth + 1);
}

function kbCheckCall(user, name, args) {
  const mode = KB_READ.has(name) ? 'r' : KB_WRITE.has(name) ? 'w' : null;
  if (!mode) return deny(`herramienta_no_permitida:${String(name).slice(0, 40)}`);
  if (user.role === 'cliente' && !KB_CLIENT_TOOLS.has(name)) return deny(`herramienta_no_permitida_para_cliente:${String(name).slice(0, 40)}`);
  if (!args || typeof args !== 'object' || Array.isArray(args)) return deny('argumentos_invalidos');

  for (const k of KB_FORBIDDEN_KEYS) if (k in args) return deny(`argumento_prohibido:${k}`);
  if (args.search_all_projects) return deny('argumento_prohibido:search_all_projects');

  const project = args.project;
  if (typeof project !== 'string' || !project) return deny('project_obligatorio');
  const space = spaceFromKbProject(project);
  if (!space) return deny('proyecto_desconocido');
  const acc = access(user, space);
  if (!acc) return deny('sin_acceso_al_espacio');
  if (mode === 'w' && acc !== 'rw') return deny('solo_lectura');

  for (const s of strings(args)) {
    const t = s.trim();
    if (/(^|[\\/])\.\.([\\/]|$)/.test(t)) return deny('ruta_con_punto_punto');
    if (/^memory:/i.test(t)) {
      const m = /^memory:\/\/([^/]*)/i.exec(t);
      let seg = '';
      try { seg = decodeURIComponent(m ? m[1] : ''); } catch { return deny('url_memory_invalida'); }
      if (seg !== project) return deny('url_memory_de_otro_proyecto');
    }
  }
  return ok();
}

/** Mensajes de una sesion Basic Memory. */
export function checkKbRpc(user, msgs) {
  const admin = user.role === 'admin';
  for (const m of msgs) {
    if (!methodAllowed(m, admin)) return deny(`metodo_no_permitido:${String(m.method).slice(0, 40)}`);
    if (admin || m.method !== 'tools/call') continue;
    const r = kbCheckCall(user, m.params && m.params.name, m.params && m.params.arguments);
    if (!r.ok) return r;
  }
  return ok();
}
