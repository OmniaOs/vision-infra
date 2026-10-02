// Servicio de memoria corta de Omnia (reemplaza a OpenMemory/Mem0 en el camino de escritura).
//
// Por que existe: OpenMemory esta descontinuado y su extractor (un LLM con un prompt de "informacion personal")
// descartaba o deformaba las lecciones tecnicas y podia borrar memorias existentes. Aqui NO hay LLM al escribir:
//   - guarda el texto tal cual lo escribe la persona;
//   - rechaza lo que no sirve (demasiado corto, solo un titulo o un id, secretos) con un motivo claro;
//   - no duplica lo que ya existe (parecido por significado);
//   - todo queda en la MISMA coleccion de Qdrant que ya usaba Mem0, filtrado por `user_id` = namespace.
//
// Habla el protocolo MCP sobre SSE con las mismas herramientas y el mismo camino de URLs que OpenMemory, asi el gateway
// (politicas, sesiones, tokens) y los clientes no cambian. Escucha solo en loopback y exige un secreto interno.

import http from 'node:http';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const NS_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const CLIENT_RE = /^[a-z0-9_-]{1,32}$/;
const ID_RE = /^[0-9a-fA-F-]{8,64}$/;
const SEARCH_LIMIT = 10;
const SEARCH_MIN_SCORE = 0.2;
const DUPLICATE_SCORE = 0.92;
const LIST_CAP = 500;
const MIN_CHARS = 25;
const MIN_WORDS = 5;
const MAX_CHARS = 1500;

const SECRET_PATTERNS = [
  /omnia_[A-Za-z0-9_-]{20,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(password|passwd|contrase(?:ñ|n)a|secret|token|api[_-]?key)\s*[:=]\s*\S{8,}/i,
];

/** Decide si un texto merece guardarse. Devuelve { ok: true, text } o { ok: false, reason } (motivo accionable). */
export function checkQuality(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < MIN_CHARS) return { ok: false, reason: `Demasiado corta (${text.length} caracteres). Escribe una oración completa con el dato concreto, de al menos ${MIN_CHARS}.` };
  if (text.length > MAX_CHARS) return { ok: false, reason: `Demasiado larga (${text.length} caracteres). Divídela en lecciones de una idea cada una, de menos de ${MAX_CHARS}.` };
  if (/^[\w.-]+:[0-9a-f]{6,}$/i.test(text)) return { ok: false, reason: 'Es solo un identificador. Guarda lo que significa, en una oración completa.' };
  if (text.split(' ').length < MIN_WORDS) return { ok: false, reason: `Parece un título, no una lección (menos de ${MIN_WORDS} palabras). Escribe qué pasó, por qué y qué hacer.` };
  if (/^(intereses|menciones|proyecto|referencia|tags)\b/i.test(text) && text.length < 90) return { ok: false, reason: 'Es una etiqueta o una lista de temas, no una lección. Escribe el hecho concreto.' };
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) return { ok: false, reason: 'Parece contener una contraseña, token o clave. No se guardan secretos: descríbelo sin el valor.' };
  return { ok: true, text };
}

const TOOLS = [
  {
    name: 'add_memories',
    description: 'Guarda una lección corta del equipo EXACTAMENTE como la escribes (sin reescribirla). Debe ser una oración completa y autocontenida (5 palabras o más) con el dato concreto. Se rechazan títulos, ids, secretos y lo que ya existe.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'La lección, en una o dos oraciones completas.' } }, required: ['text'] },
  },
  {
    name: 'search_memory',
    description: 'Busca lecciones por significado dentro de este espacio.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  { name: 'list_memories', description: 'Lista las lecciones de este espacio, de la más reciente a la más antigua.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'delete_memory',
    description: 'Borra UNA lección de este espacio por su id.',
    inputSchema: { type: 'object', properties: { memory_id: { type: 'string' } }, required: ['memory_id'] },
  },
  { name: 'delete_all_memories', description: 'Borra TODAS las lecciones de este espacio (solo administradores).', inputSchema: { type: 'object', properties: {} } },
];

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export function createMemoryServer({
  qdrantUrl = 'http://mem0_store:6333', qdrantKey, collection = 'openmemory',
  openaiKey, openaiBase = 'https://api.openai.com/v1', embeddingModel = 'text-embedding-3-small',
  internalSecret, log = () => {}, fetchImpl = fetch, pingMs = 15000,
} = {}) {
  const base = String(qdrantUrl).replace(/\/$/, '');
  const colPath = `/collections/${encodeURIComponent(collection)}`;
  let dims = 0;
  let ready = null;

  async function qdrant(method, path, body) {
    const r = await fetchImpl(base + path, {
      method, headers: { 'content-type': 'application/json', ...(qdrantKey ? { 'api-key': qdrantKey } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    return r;
  }

  async function embed(text) {
    if (!openaiKey) throw new Error('sin_llave_de_embeddings');
    for (let attempt = 0; ; attempt++) {
      const r = await fetchImpl(`${openaiBase.replace(/\/$/, '')}/embeddings`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: embeddingModel, input: text, ...(dims && /text-embedding-3/.test(embeddingModel) ? { dimensions: dims } : {}) }),
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) {
        const vector = (await r.json()).data?.[0]?.embedding;
        if (!Array.isArray(vector)) throw new Error('embedding_invalido');
        if (dims && vector.length !== dims) throw new Error(`dimension_distinta:${vector.length}!=${dims}`);
        return vector;
      }
      if (attempt >= 1 || ![429, 500, 502, 503].includes(r.status)) throw new Error(`embeddings_http_${r.status}`);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  /** Lee las dimensiones de la coleccion (o la crea si no existe). Se reintenta si falla. */
  function ensureReady() {
    ready ||= (async () => {
      const r = await qdrant('GET', colPath);
      if (r.status === 404) {
        const created = await qdrant('PUT', colPath, { vectors: { size: 1536, distance: 'Cosine' } });
        if (!created.ok) throw new Error(`qdrant_crear_${created.status}`);
        dims = 1536;
        return;
      }
      if (!r.ok) throw new Error(`qdrant_http_${r.status}`);
      const vectors = (await r.json()).result?.config?.params?.vectors;
      if (!vectors || typeof vectors.size !== 'number') throw new Error('coleccion_con_vectores_con_nombre_no_soportada');
      dims = vectors.size;
    })().catch((e) => { ready = null; throw e; });
    return ready;
  }

  const mustNs = (ns) => ({ key: 'user_id', match: { value: ns } });
  const shape = (p) => ({ id: String(p.id), memory: p.payload?.data ?? '', hash: p.payload?.hash ?? null, created_at: p.payload?.created_at ?? null, updated_at: p.payload?.updated_at ?? null });

  async function search(ns, query, limit = SEARCH_LIMIT) {
    await ensureReady();
    const vector = await embed(query);
    const r = await qdrant('POST', `${colPath}/points/search`, { vector, filter: { must: [mustNs(ns)] }, limit, with_payload: true, score_threshold: SEARCH_MIN_SCORE });
    if (!r.ok) throw new Error(`qdrant_http_${r.status}`);
    return ((await r.json()).result || []).filter((p) => p.payload?.user_id === ns).map((p) => ({ ...shape(p), score: p.score }));
  }

  async function add(ns, rawText, { author = null, client = null } = {}) {
    const q = checkQuality(rawText);
    if (!q.ok) return { rejected: q.reason };
    await ensureReady();
    const vector = await embed(q.text);
    const near = await qdrant('POST', `${colPath}/points/search`, { vector, filter: { must: [mustNs(ns)] }, limit: 1, with_payload: true });
    if (!near.ok) throw new Error(`qdrant_http_${near.status}`);
    const top = ((await near.json()).result || [])[0];
    if (top && top.score >= DUPLICATE_SCORE && top.payload?.user_id === ns) return { duplicate: { ...shape(top), score: top.score } };
    const id = randomUUID();
    const payload = { data: q.text, hash: createHash('md5').update(q.text).digest('hex'), created_at: new Date().toISOString(), user_id: ns, source_app: 'omnia', mcp_client: client, author };
    const put = await qdrant('PUT', `${colPath}/points?wait=true`, { points: [{ id, vector, payload }] });
    if (!put.ok) throw new Error(`qdrant_http_${put.status}`);
    return { added: { id, memory: q.text } };
  }

  async function list(ns) {
    await ensureReady();
    const out = [];
    let offset = null;
    do {
      const r = await qdrant('POST', `${colPath}/points/scroll`, { filter: { must: [mustNs(ns)] }, limit: 100, with_payload: true, with_vector: false, ...(offset ? { offset } : {}) });
      if (!r.ok) throw new Error(`qdrant_http_${r.status}`);
      const { result } = await r.json();
      for (const p of result?.points || []) if (p.payload?.user_id === ns) out.push(shape(p));
      offset = result?.next_page_offset ?? null;
    } while (offset && out.length < LIST_CAP);
    return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, LIST_CAP);
  }

  async function remove(ns, id) {
    await ensureReady();
    const where = { must: [mustNs(ns), { has_id: [id] }] };
    const found = await qdrant('POST', `${colPath}/points/scroll`, { filter: where, limit: 1, with_payload: true, with_vector: false });
    if (!found.ok) throw new Error(`qdrant_http_${found.status}`);
    const point = ((await found.json()).result?.points || []).find((p) => p.payload?.user_id === ns);
    if (!point) return null;
    const del = await qdrant('POST', `${colPath}/points/delete?wait=true`, { filter: where });
    if (!del.ok) throw new Error(`qdrant_http_${del.status}`);
    return shape(point);
  }

  async function removeAll(ns) {
    await ensureReady();
    const where = { must: [mustNs(ns)] };
    const count = await qdrant('POST', `${colPath}/points/count`, { filter: where, exact: true });
    const n = count.ok ? (await count.json()).result?.count ?? 0 : 0;
    const del = await qdrant('POST', `${colPath}/points/delete?wait=true`, { filter: where });
    if (!del.ok) throw new Error(`qdrant_http_${del.status}`);
    return n;
  }

  // ---------- herramientas MCP ----------

  const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] });
  const failure = (message) => ({ content: [{ type: 'text', text: message }], isError: true });

  async function callTool(session, name, args) {
    const ns = session.ns;
    try {
      if (name === 'add_memories') {
        const r = await add(ns, args.text, { author: session.author, client: session.client });
        if (r.rejected) return failure(`No se guardó: ${r.rejected}`);
        if (r.duplicate) return text({ results: [{ id: r.duplicate.id, memory: r.duplicate.memory, event: 'NONE' }], note: 'Ya existía una lección equivalente; no se duplicó.' });
        return text({ results: [{ id: r.added.id, memory: r.added.memory, event: 'ADD' }] });
      }
      if (name === 'search_memory') {
        if (typeof args.query !== 'string' || !args.query.trim()) return failure('Falta el texto a buscar.');
        return text(await search(ns, args.query.slice(0, 500)));
      }
      if (name === 'list_memories') return text(await list(ns));
      if (name === 'delete_memory') {
        if (typeof args.memory_id !== 'string' || !ID_RE.test(args.memory_id)) return failure('memory_id no es válido.');
        const removed = await remove(ns, args.memory_id);
        return removed ? text({ message: 'Memoria borrada', removed }) : failure('No existe esa memoria en este espacio.');
      }
      if (name === 'delete_all_memories') return text({ message: `Se borraron ${await removeAll(ns)} memorias de este espacio.` });
      return failure(`Herramienta desconocida: ${String(name).slice(0, 40)}`);
    } catch (e) {
      log({ t: new Date().toISOString(), ev: 'memoria_error', tool: name, ns, error: String(e.message).slice(0, 120) });
      return failure('El servicio de memoria no pudo completar la operación. Reintenta en un momento.');
    }
  }

  // ---------- MCP sobre SSE ----------

  const sessions = new Map(); // sid -> { res, ns, client, author, ping }
  const send = (session, message) => session.res.write(`event: message\r\ndata: ${JSON.stringify(message)}\r\n\r\n`);

  async function handleRpc(session, msg) {
    const reply = (result) => send(session, { jsonrpc: '2.0', id: msg.id, result });
    if (msg.method === undefined || msg.id === undefined) return; // notificaciones y respuestas del cliente
    switch (msg.method) {
      case 'initialize': return reply({ protocolVersion: msg.params?.protocolVersion || '2024-11-05', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'omnia-memory', version: '1' } });
      case 'ping': return reply({});
      case 'tools/list': return reply({ tools: TOOLS });
      case 'resources/list': return reply({ resources: [] });
      case 'prompts/list': return reply({ prompts: [] });
      case 'tools/call': {
        const params = msg.params || {};
        return reply(await callTool(session, params.name, params.arguments && typeof params.arguments === 'object' ? params.arguments : {}));
      }
      default: return send(session, { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Metodo no soportado' } });
    }
  }

  const server = http.createServer((req, res) => {
    const reply = (status, body = '') => { res.writeHead(status, { 'content-type': 'text/plain' }); res.end(body); };
    const url = new URL(req.url, 'http://internal');
    if (url.pathname === '/healthz') return reply(200, 'ok');
    const given = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!internalSecret || !given || !safeEqual(given, internalSecret)) return reply(401, 'unauthorized');

    const sse = /^\/mcp\/([^/]+)\/sse\/([^/]+)$/.exec(url.pathname);
    if (req.method === 'GET' && sse) {
      if (!CLIENT_RE.test(sse[1]) || !NS_RE.test(sse[2])) return reply(400, 'invalid');
      const sid = randomBytes(16).toString('hex');
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const session = { res, ns: sse[2], client: sse[1], author: String(req.headers['x-omnia-dev'] || '').slice(0, 64) || null };
      session.ping = setInterval(() => res.write(': ping\r\n\r\n'), pingMs);
      session.ping.unref?.();
      sessions.set(sid, session);
      res.write(`event: endpoint\r\ndata: /mcp/messages/?session_id=${sid}\r\n\r\n`);
      req.on('close', () => { clearInterval(session.ping); sessions.delete(sid); });
      return;
    }

    if (req.method === 'POST' && /^\/mcp\/messages\/?$/.test(url.pathname)) {
      const session = sessions.get(url.searchParams.get('session_id'));
      if (!session) return reply(404, 'Could not find session');
      const chunks = []; let size = 0;
      req.on('data', (c) => { size += c.length; if (size <= 64 * 1024) chunks.push(c); });
      req.on('end', () => {
        if (size > 64 * 1024) return reply(413, 'too large');
        let messages;
        try { const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); messages = Array.isArray(parsed) ? parsed : [parsed]; } catch { return reply(400, 'invalid json'); }
        reply(202, 'Accepted');
        for (const msg of messages) if (msg && typeof msg === 'object') handleRpc(session, msg).catch((e) => log({ t: new Date().toISOString(), ev: 'memoria_rpc_error', error: String(e.message).slice(0, 120) }));
      });
      return;
    }
    reply(404, 'not found');
  });

  server.closeSessions = () => { for (const s of sessions.values()) { clearInterval(s.ping); s.res.destroy(); } sessions.clear(); };
  server.memory = { add, search, list, remove, removeAll, ensureReady };
  return server;
}
