// Solo lectura del portal: notas de Basic Memory y memorias de Mem0, filtradas por los espacios de quien pregunta.
//
//   GET /api/notes/projects                 proyectos que puedo ver
//   GET /api/notes/tree?project=X           notas de un proyecto (sin contenido)
//   GET /api/notes/note?project=X&id=perma  una nota (markdown + frontmatter)
//   GET /api/graph/spaces                   espacios cuyas memorias puedo ver, con cuantas hay (el admin ve tambien los namespaces sin espacio)
//   GET /api/graph?space=S                  memorias de Mem0 de un espacio (textos de Qdrant, categorias de la REST si hay)
//
// Nada de aqui escribe. El permiso es el mismo de siempre (policy.access): admin todo, miembro/lectura el global y
// sus espacios, cliente solo el suyo. Basic Memory se llama con `project` siempre fijado por el servidor, y un
// identificador que apunte a otro proyecto (memory://...) se rechaza.

import { access, listKbAliases, listNamespaceAliases, mem0Namespace, spaceFromKbProject, spaceFromMem0, SPACE_RE } from './policy.mjs';
import { callMcpTool } from './mcp-client.mjs';
import { analyzeMemories } from './cluster.mjs';

const PROJECT_ADMIN_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/; // el admin ve proyectos aun no migrados al nombre de espacio
const MAX_NOTE_BYTES = 256 * 1024;
const MAX_MEMORIES = 500;
const PAGE = 100;
const CACHE_MS = 60_000;
const LEGACY_NS_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function createViewerApi({ routes, store, qdrantUrl, qdrantCollection, qdrantKey, cacheMs = CACHE_MS, log = () => {}, callTool = callMcpTool, fetchImpl = fetch }) {
  const qdrant = { url: String(qdrantUrl || 'http://mem0_store:6333').replace(/\/$/, ''), collection: qdrantCollection || 'openmemory', key: qdrantKey };
  const kb = routes.find((r) => r.name === 'knowledge');
  const mem0 = routes.find((r) => r.name === 'mem0');

  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const canSee = (actor, space) => Boolean(space) && Boolean(access(actor, space));
  const kbCall = (tool, args) => callTool({ base: kb.upstream, auth: kb.upstreamAuth, tool, args });
  const read = (actor, what, target) => log({ t: new Date().toISOString(), ev: 'lectura', by: actor.id, what, target });

  /** Un proyecto es visible si su nombre es un espacio al que tengo acceso (el admin ve todos). */
  const projectVisible = (actor, name) =>
    typeof name === 'string' && (actor.role === 'admin' ? PROJECT_ADMIN_RE.test(name) : canSee(actor, spaceFromKbProject(name)));

  async function projects(actor, res) {
    const out = await kbCall('list_memory_projects', { output_format: 'json' });
    const list = (out && out.projects) || [];
    const visible = list
      .filter((p) => projectVisible(actor, p.name))
      .map((p) => ({ name: p.name, space: spaceFromKbProject(p.name), access: actor.role === 'admin' ? 'rw' : access(actor, p.name) }));
    return send(res, 200, { projects: visible });
  }

  async function tree(actor, res, project) {
    if (!projectVisible(actor, project)) return send(res, 404, { error: 'no_existe' });
    const notes = [];
    for (let page = 1; page <= 10; page++) {
      const out = await kbCall('list_directory', { project, dir_name: '/', depth: 10, page, page_size: 200, output_format: 'json' });
      for (const n of out.nodes || []) {
        if (n.type === 'file' && n.permalink) {
          notes.push({ title: n.title || n.name, permalink: n.permalink, path: n.file_path, noteType: n.note_type || null, updatedAt: n.updated_at || null });
        }
      }
      if (!out.has_more) break;
    }
    read(actor, 'notas', project);
    return send(res, 200, { project, notes });
  }

  async function note(actor, res, project, id) {
    if (!projectVisible(actor, project)) return send(res, 404, { error: 'no_existe' });
    if (typeof id !== 'string' || !id || id.length > 300 || /memory:\/\//i.test(id) || id.includes('\0')) return send(res, 400, { error: 'invalido' });
    const n = await kbCall('read_note', { project, identifier: id, output_format: 'json' });
    if (!n || typeof n.content !== 'string') return send(res, 404, { error: 'no_existe' });
    if (Buffer.byteLength(n.content) > MAX_NOTE_BYTES) return send(res, 413, { error: 'nota_demasiado_grande' });
    read(actor, 'nota', `${project}/${n.permalink}`);
    return send(res, 200, { project, title: n.title, permalink: n.permalink, path: n.file_path, content: n.content, frontmatter: n.frontmatter || {} });
  }

  /** Textos desde Qdrant (la fuente que siempre los tiene), filtrados por el namespace del espacio. */
  async function scrollMemories(namespace) {
    const out = [];
    let offset = null;
    do {
      const r = await fetchImpl(`${qdrant.url}/collections/${encodeURIComponent(qdrant.collection)}/points/scroll`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(qdrant.key ? { 'api-key': qdrant.key } : {}) },
        body: JSON.stringify({ filter: { must: [{ key: 'user_id', match: { value: namespace } }] }, limit: PAGE, with_payload: true, with_vector: true, ...(offset ? { offset } : {}) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`qdrant_http_${r.status}`);
      const { result } = await r.json();
      for (const point of result?.points || []) {
        const payload = point.payload || {};
        // Defensa en profundidad: aunque el filtro falle, un punto de otro namespace nunca sale.
        if (payload.user_id !== namespace || typeof payload.data !== 'string') continue;
        const v = point.vector;
        const vector = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v).find(Array.isArray) : undefined; // vector unico o con nombre
        out.push({ id: String(point.id), content: payload.data.slice(0, 2000), createdAt: payload.created_at ?? null, categories: [], app: null, vector });
      }
      offset = result?.next_page_offset ?? null;
    } while (offset && out.length < MAX_MEMORIES);
    return out;
  }

  /** Categorias y app desde la REST de OpenMemory (SQL). Es un extra: si falla o esta vacia, el grafo sigue. */
  async function restDetails(namespace) {
    const details = new Map();
    if (!mem0 || mem0.native) return details; // el servicio propio no tiene la REST de OpenMemory (categorias)
    try {
      for (let page = 1; page <= 5; page++) {
        const r = await fetchImpl(`${mem0.upstream}/api/v1/memories/?user_id=${encodeURIComponent(namespace)}&page=${page}&size=${PAGE}`, {
          headers: mem0.upstreamAuth ? { authorization: mem0.upstreamAuth } : {}, signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) break;
        const body = await r.json();
        const items = Array.isArray(body) ? body : body.items || [];
        for (const m of items) {
          if (m && m.id) details.set(String(m.id), { categories: Array.isArray(m.categories) ? m.categories.map(String).slice(0, 8) : [], app: m.app_name ?? null });
        }
        if (items.length < PAGE || (body.pages && page >= body.pages)) break;
      }
    } catch { /* sin extras */ }
    return details;
  }

  const cache = new Map(); // clave -> { t, value }
  async function cached(key, make) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < cacheMs) return hit.value;
    const value = await make();
    cache.set(key, { t: Date.now(), value });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return value;
  }

  /** Cuantas memorias hay por namespace: la faceta de Qdrant y, si no existe en esa version, un recuento por barrido. */
  async function countByNamespace() {
    const headers = { 'content-type': 'application/json', ...(qdrant.key ? { 'api-key': qdrant.key } : {}) };
    const base = `${qdrant.url}/collections/${encodeURIComponent(qdrant.collection)}`;
    const facet = await fetchImpl(`${base}/facet`, { method: 'POST', headers, body: JSON.stringify({ key: 'user_id', limit: 200, exact: true }), signal: AbortSignal.timeout(15000) });
    if (facet.ok) return new Map(((await facet.json()).result?.hits || []).map((h) => [String(h.value), Number(h.count)]));
    const counts = new Map(); let offset = null; let seen = 0;
    do {
      const r = await fetchImpl(`${base}/points/scroll`, { method: 'POST', headers, body: JSON.stringify({ limit: 500, with_payload: ['user_id'], with_vector: false, ...(offset ? { offset } : {}) }), signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`qdrant_http_${r.status}`);
      const { result } = await r.json();
      for (const p of result?.points || []) { const u = p.payload?.user_id; if (typeof u === 'string') counts.set(u, (counts.get(u) || 0) + 1); seen++; }
      offset = result?.next_page_offset ?? null;
    } while (offset && seen < 20000);
    return counts;
  }

  /** Espacios con memorias. Un admin ve tambien los namespaces antiguos que aun no son un espacio (`ns:<nombre>`). */
  async function graphSpaces(actor, res) {
    const counts = await cached('counts', countByNamespace);
    const entries = new Map();
    for (const [ns, count] of counts) {
      const space = spaceFromMem0(ns);
      if (space && canSee(actor, space)) entries.set(space, { id: space, label: space, count, mapped: true });
      else if (!space && actor.role === 'admin' && LEGACY_NS_RE.test(ns)) entries.set(`ns:${ns}`, { id: `ns:${ns}`, label: ns, count, mapped: false });
    }
    // Sus espacios aparecen aunque aun no tengan memorias.
    const known = new Set(['global', ...(actor.spaces || []), ...(actor.role === 'admin' ? store.all().flatMap((u) => u.spaces) : [])]);
    for (const space of known) if (canSee(actor, space) && !entries.has(space)) entries.set(space, { id: space, label: space, count: 0, mapped: true });
    const spaces = [...entries.values()].sort((a, b) => Number(b.mapped) - Number(a.mapped) || b.count - a.count || a.id.localeCompare(b.id));
    return send(res, 200, { spaces });
  }

  /** Namespace de Mem0 que corresponde a un espacio (o a `ns:<namespace>` sin asignar, solo admin). null si no existe o no puede verlo. */
  function resolveNamespace(actor, space) {
    if (typeof space === 'string' && space.startsWith('ns:')) {
      const legacy = space.slice(3);
      return actor.role === 'admin' && LEGACY_NS_RE.test(legacy) && !spaceFromMem0(legacy) ? legacy : null;
    }
    return SPACE_RE.test(space || '') && canSee(actor, space) ? mem0Namespace(space) : null;
  }

  const ID_RE = /^[0-9a-fA-F-]{8,64}$/;
  const MAX_DELETE = 200;

  /**
   * Borra memorias de UN namespace (admin). El filtro por namespace va siempre junto al id, asi un id de otro espacio no se toca.
   * Devuelve { removed: [{id, content}], missing } o { error, status }.
   */
  async function deleteMemories(actor, space, ids) {
    const namespace = resolveNamespace(actor, space);
    if (!namespace) return { error: 'no_existe', status: 404 };
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_DELETE || !ids.every((id) => ID_RE.test(id))) return { error: 'invalido', status: 400 };
    const unique = [...new Set(ids)];
    const headers = { 'content-type': 'application/json', ...(qdrant.key ? { 'api-key': qdrant.key } : {}) };
    const base = `${qdrant.url}/collections/${encodeURIComponent(qdrant.collection)}/points`;
    const where = (list) => ({ must: [{ key: 'user_id', match: { value: namespace } }, { has_id: list }] });
    const found = await fetchImpl(`${base}/scroll`, { method: 'POST', headers, body: JSON.stringify({ filter: where(unique), limit: unique.length, with_payload: true, with_vector: false }), signal: AbortSignal.timeout(15000) });
    if (!found.ok) throw new Error(`qdrant_http_${found.status}`);
    const points = ((await found.json()).result?.points || []).filter((p) => p.payload?.user_id === namespace);
    if (points.length === 0) return { removed: [], missing: unique.length };
    const del = await fetchImpl(`${base}/delete?wait=true`, { method: 'POST', headers, body: JSON.stringify({ filter: where(points.map((p) => p.id)) }), signal: AbortSignal.timeout(15000) });
    if (!del.ok) throw new Error(`qdrant_http_${del.status}`);
    cache.delete(`g:${namespace}`);
    cache.delete('counts');
    return { removed: points.map((p) => ({ id: String(p.id), content: String(p.payload?.data ?? '').slice(0, 300) })), missing: unique.length - points.length };
  }

  async function graph(actor, res, space) {
    const namespace = resolveNamespace(actor, space);
    if (!namespace) return send(res, 404, { error: 'no_existe' });
    const data = await cached(`g:${namespace}`, async () => {
      const [points, details] = await Promise.all([scrollMemories(namespace), restDetails(namespace)]);
      const { clusters, assignment, links } = analyzeMemories(points);
      const memories = points
        .map(({ vector, ...m }) => ({ ...m, ...(details.get(m.id) || {}), cluster: assignment[m.id] ?? null }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, MAX_MEMORIES);
      return { memories, clusters, links };
    });
    read(actor, 'memorias', space);
    return send(res, 200, { space, total: data.memories.length, ...data });
  }

  const safeCounts = () => cached('counts', countByNamespace).catch(() => new Map());

  /** Para administrar: cada namespace de Mem0 con cuantas memorias tiene y a que espacio corresponde (null = sin asignar). */
  async function namespaceRows() {
    const counts = await safeCounts();
    const aliased = new Set(listNamespaceAliases().map(([ns]) => ns));
    return [...new Set([...counts.keys(), ...aliased])]
      .filter((ns) => LEGACY_NS_RE.test(ns))
      .map((namespace) => ({ namespace, count: counts.get(namespace) ?? 0, space: spaceFromMem0(namespace), aliased: aliased.has(namespace) }))
      .sort((a, b) => b.count - a.count || a.namespace.localeCompare(b.namespace));
  }

  /** Para administrar: cada proyecto de Basic Memory y a que espacio corresponde (null = sin asignar). */
  async function projectRows() {
    const aliased = new Set(listKbAliases().map(([name]) => name));
    const projects = (await kbCall('list_memory_projects', { output_format: 'json' }))?.projects || [];
    return [...new Set([...projects.map((p) => p.name), ...aliased])]
      .filter((name) => LEGACY_NS_RE.test(name))
      .map((name) => ({ name, space: spaceFromKbProject(name), aliased: aliased.has(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Espacios que ya existen en algun sitio (memorias, notas, alias o personas): lo que se puede asignar a alguien. */
  async function catalog() {
    const counts = await safeCounts();
    const ids = new Set(['global']);
    for (const ns of counts.keys()) { const space = spaceFromMem0(ns); if (space) ids.add(space); }
    for (const [, space] of [...listNamespaceAliases(), ...listKbAliases()]) ids.add(space);
    for (const user of store.all()) for (const space of user.spaces) ids.add(space);
    const notes = new Set();
    try {
      for (const project of (await kbCall('list_memory_projects', { output_format: 'json' }))?.projects || []) {
        const space = spaceFromKbProject(project.name);
        if (space) { ids.add(space); notes.add(space); }
      }
    } catch { /* sin Basic Memory: se muestran los demas */ }
    return [...ids].sort().map((id) => ({ id, memories: counts.get(mem0Namespace(id)) ?? 0, hasNotes: notes.has(id) }));
  }

  /** Devuelve true si la ruta era suya. */
  async function handle(req, res, url, actor) {
    const p = url.pathname;
    if (!p.startsWith('/api/notes') && !p.startsWith('/api/graph')) return false;
    if (req.method !== 'GET') { send(res, 405, { error: 'method_not_allowed' }); return true; }
    try {
      if (p === '/api/notes/projects') await projects(actor, res);
      else if (p === '/api/notes/tree') await tree(actor, res, url.searchParams.get('project'));
      else if (p === '/api/notes/note') await note(actor, res, url.searchParams.get('project'), url.searchParams.get('id'));
      else if (p === '/api/graph/spaces') await graphSpaces(actor, res);
      else if (p === '/api/graph') await graph(actor, res, url.searchParams.get('space'));
      else send(res, 404, { error: 'not_found' });
    } catch (e) {
      log({ t: new Date().toISOString(), ev: 'lectura_error', by: actor.id, error: String(e.message).slice(0, 80) });
      send(res, 502, { error: 'origen_no_disponible' });
    }
    return true;
  }

  return { handle, namespaceRows, projectRows, catalog, deleteMemories };
}
