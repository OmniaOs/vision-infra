// Solo lectura del portal: notas de Basic Memory y memorias de Mem0, filtradas por los espacios de quien pregunta.
//
//   GET /api/notes/projects                 proyectos que puedo ver
//   GET /api/notes/tree?project=X           notas de un proyecto (sin contenido)
//   GET /api/notes/note?project=X&id=perma  una nota (markdown + frontmatter)
//   GET /api/graph/spaces                   espacios cuyas memorias puedo ver
//   GET /api/graph?space=S                  memorias de Mem0 de un espacio (textos de Qdrant, categorias de la REST si hay)
//
// Nada de aqui escribe. El permiso es el mismo de siempre (policy.access): admin todo, miembro/lectura el global y
// sus espacios, cliente solo el suyo. Basic Memory se llama con `project` siempre fijado por el servidor, y un
// identificador que apunte a otro proyecto (memory://...) se rechaza.

import { access, mem0Namespace, spaceFromKbProject, SPACE_RE } from './policy.mjs';
import { callMcpTool } from './mcp-client.mjs';

const PROJECT_ADMIN_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/; // el admin ve proyectos aun no migrados al nombre de espacio
const MAX_NOTE_BYTES = 256 * 1024;
const MAX_MEMORIES = 500;
const PAGE = 100;

export function createViewerApi({ routes, store, qdrantUrl, qdrantCollection, qdrantKey, log = () => {}, callTool = callMcpTool, fetchImpl = fetch }) {
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

  function graphSpaces(actor, res) {
    const all = new Set(['global']);
    for (const u of store.all()) for (const s of u.spaces) all.add(s);
    for (const s of actor.spaces || []) all.add(s);
    return send(res, 200, { spaces: [...all].filter((s) => canSee(actor, s)).sort() });
  }

  /** Textos desde Qdrant (la fuente que siempre los tiene), filtrados por el namespace del espacio. */
  async function scrollMemories(namespace) {
    const out = [];
    let offset = null;
    do {
      const r = await fetchImpl(`${qdrant.url}/collections/${encodeURIComponent(qdrant.collection)}/points/scroll`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(qdrant.key ? { 'api-key': qdrant.key } : {}) },
        body: JSON.stringify({ filter: { must: [{ key: 'user_id', match: { value: namespace } }] }, limit: PAGE, with_payload: true, with_vector: false, ...(offset ? { offset } : {}) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`qdrant_http_${r.status}`);
      const { result } = await r.json();
      for (const point of result?.points || []) {
        const payload = point.payload || {};
        // Defensa en profundidad: aunque el filtro falle, un punto de otro namespace nunca sale.
        if (payload.user_id !== namespace || typeof payload.data !== 'string') continue;
        out.push({ id: String(point.id), content: payload.data.slice(0, 2000), createdAt: payload.created_at ?? null, categories: [], app: null });
      }
      offset = result?.next_page_offset ?? null;
    } while (offset && out.length < MAX_MEMORIES);
    return out;
  }

  /** Categorias y app desde la REST de OpenMemory (SQL). Es un extra: si falla o esta vacia, el grafo sigue. */
  async function restDetails(namespace) {
    const details = new Map();
    if (!mem0) return details;
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

  async function graph(actor, res, space) {
    if (!SPACE_RE.test(space || '') || !canSee(actor, space)) return send(res, 404, { error: 'no_existe' });
    const namespace = mem0Namespace(space);
    const [points, details] = await Promise.all([scrollMemories(namespace), restDetails(namespace)]);
    const memories = points
      .map((m) => ({ ...m, ...(details.get(m.id) || {}) }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, MAX_MEMORIES);
    read(actor, 'memorias', space);
    return send(res, 200, { space, total: memories.length, memories });
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
      else if (p === '/api/graph/spaces') graphSpaces(actor, res);
      else if (p === '/api/graph') await graph(actor, res, url.searchParams.get('space'));
      else send(res, 404, { error: 'not_found' });
    } catch (e) {
      log({ t: new Date().toISOString(), ev: 'lectura_error', by: actor.id, error: String(e.message).slice(0, 80) });
      send(res, 502, { error: 'origen_no_disponible' });
    }
    return true;
  }

  return { handle };
}
