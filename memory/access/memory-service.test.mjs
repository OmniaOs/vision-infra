// node --test memory/access
// Servicio de memoria propio: guarda tal cual, filtra calidad, no duplica, aisla por namespace y encaja en el gateway.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';
import { callMcpTool, listMcpTools } from './mcp-client.mjs';
import { checkQuality, createMemoryServer } from './memory-service.mjs';

const SECRET = 'secreto-interno-0123456789';
const DIMS = 64;
const MEM = 'omnia_mem_token_0123456789abcdef'; // miembro: int-frutal
const LEC = 'omnia_lec_token_0123456789abcdef'; // lectura: int-frutal
const ADM = 'omnia_adm_token_0123456789abcdef';
const SSH = 'Las desconexiones de SSH durante el proceso no interrumpen el contenedor que sigue corriendo del lado del servidor';

// ---------- fakes ----------
let points; // Qdrant falso en memoria
let embedMode = 'ok';
let embedCalls = 0;

const vectorOf = (text) => {
  const v = new Array(DIMS).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    let h = 0;
    for (const ch of word) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    v[h % DIMS] += 1;
  }
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
};
const cosine = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const matches = (filter, p) => (filter?.must || []).every((c) => (c.key === 'user_id' ? p.payload.user_id === c.match.value : c.has_id.includes(p.id)));

function fakeQdrant() {
  return http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const q = body ? JSON.parse(body) : {};
      const json = (result) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result })); };
      const url = req.url.split('?')[0];
      if (req.method === 'GET' && url === '/collections/openmemory') return json({ config: { params: { vectors: { size: DIMS, distance: 'Cosine' } } } });
      if (url.endsWith('/points') && req.method === 'PUT') { for (const p of q.points) points.push(p); return json({ status: 'completed' }); }
      if (url.endsWith('/points/search')) {
        const hits = points.filter((p) => matches(q.filter, p)).map((p) => ({ id: p.id, score: cosine(q.vector, p.vector), payload: p.payload }))
          .filter((h) => h.score >= (q.score_threshold ?? -1)).sort((a, b) => b.score - a.score).slice(0, q.limit);
        return json(hits);
      }
      if (url.endsWith('/points/scroll')) return json({ points: points.filter((p) => matches(q.filter, p)).slice(0, q.limit).map((p) => ({ id: p.id, payload: p.payload })), next_page_offset: null });
      if (url.endsWith('/points/count')) return json({ count: points.filter((p) => matches(q.filter, p)).length });
      if (url.endsWith('/points/delete')) { points = points.filter((p) => !matches(q.filter, p)); return json({ status: 'completed' }); }
      res.writeHead(404); res.end();
    });
  });
}

function fakeEmbedder() {
  return http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      embedCalls++;
      if (embedMode === 'down') { res.writeHead(500); return res.end(); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ embedding: vectorOf(JSON.parse(body).input) }] }));
    });
  });
}

const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));
let qdrant, embedder, memory, memPort, gw, gwPort;
const logs = [];

before(async () => {
  points = [];
  qdrant = fakeQdrant(); embedder = fakeEmbedder();
  const [qp, ep] = [await listen(qdrant), await listen(embedder)];
  memory = createMemoryServer({ qdrantUrl: `http://127.0.0.1:${qp}`, openaiKey: 'k', openaiBase: `http://127.0.0.1:${ep}`, internalSecret: SECRET, log: (e) => logs.push(e), pingMs: 60000 });
  memPort = await listen(memory);
  gw = createGateway({
    store: createStore({ envText: `mem:${hashToken(MEM)}:miembro:int-frutal,lec:${hashToken(LEC)}:lectura:int-frutal`, adminsText: `adm:${hashToken(ADM)}` }),
    routes: [{ name: 'mem0', hosts: ['127.0.0.1'], upstream: `http://127.0.0.1:${memPort}`, upstreamAuth: `Bearer ${SECRET}`, allow: ['/mcp/'] }],
    enforce: true,
  });
  gwPort = await listen(gw);
});
after(() => { memory.closeSessions(); for (const s of [gw, memory, qdrant, embedder]) { s.closeAllConnections?.(); s.close(); } });

const direct = (ns, tool, args = {}, timeoutMs = 10000) => callMcpTool({ base: `http://127.0.0.1:${memPort}`, auth: `Bearer ${SECRET}`, path: `/mcp/claude/sse/${ns}`, tool, args, timeoutMs });
const viaGateway = (token, ns, tool, args = {}, timeoutMs = 10000) => callMcpTool({ base: `http://127.0.0.1:${gwPort}`, auth: `Bearer ${token}`, path: `/mcp/claude/sse/${ns}`, tool, args, timeoutMs });
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

// ---------- filtro de calidad ----------

test('calidad: acepta oraciones tecnicas completas y rechaza titulos, ids, etiquetas, secretos y extremos', () => {
  assert.equal(checkQuality(SSH).ok, true, 'la frase que el extractor de Mem0 descartaba se acepta');
  assert.equal(checkQuality('  Coolify   exige el dominio\n con esquema y puerto para evitar el 502  ').text, 'Coolify exige el dominio con esquema y puerto para evitar el 502', 'normaliza espacios');
  for (const [bad, why] of [
    ['Evitar errores de carga', 'titulo'], ['OmniaPOS:aeae869', 'id'], ['Proyecto: OmniaPOS', 'etiqueta'], ['Intereses en Vision, DevOps, Docker, Infra', 'etiqueta'],
    ['corta', 'corta'], ['', 'vacia'], [null, 'nula'], ['x'.repeat(1501), 'larga'],
    ['El token es omnia_abcdefghijklmnopqrstuvwxyz0123456789 y sirve para entrar', 'token'], ['La contraseña: Sup3rSecreta!2026 de la base de datos', 'password'],
    ['Usar la clave -----BEGIN RSA PRIVATE KEY----- para entrar al servidor', 'llave'], ['Configurar api_key=sk-abcdefghijklmnopqrstuvwxyz1234 en el servicio', 'api key'],
  ]) assert.equal(checkQuality(bad).ok, false, `${why}: ${String(bad).slice(0, 40)}`);
  assert.match(checkQuality('Alineación de Datos Intercompañía').reason, /título/);
  assert.match(checkQuality('Evitar errores de carga').reason, /corta/);
});

// ---------- protocolo y herramientas ----------

test('MCP: expone las herramientas de siempre mas delete_memory, con su esquema', async () => {
  const tools = await listMcpTools({ base: `http://127.0.0.1:${memPort}`, auth: `Bearer ${SECRET}`, path: '/mcp/claude/sse/zz' });
  assert.deepEqual(tools.map((t) => t.name), ['add_memories', 'search_memory', 'list_memories', 'delete_memory', 'delete_all_memories']);
  assert.deepEqual(tools[0].inputSchema.required, ['text']);
});

test('guarda el texto EXACTO, lo encuentra por significado y list lo devuelve (el listado ya no sale vacio)', async () => {
  const added = parse(await direct('int-frutal', 'add_memories', { text: SSH }));
  assert.equal(added.results[0].event, 'ADD');
  assert.equal(added.results[0].memory, SSH, 'sin reescribir');
  const stored = points.find((p) => p.id === added.results[0].id);
  assert.deepEqual([stored.payload.data, stored.payload.user_id, stored.payload.source_app, stored.payload.mcp_client], [SSH, 'int-frutal', 'omnia', 'claude']);
  assert.match(stored.payload.created_at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(stored.vector.length, DIMS);
  const hits = parse(await direct('int-frutal', 'search_memory', { query: 'se corta la conexion SSH, el contenedor sigue en el servidor' }));
  assert.equal(hits[0].id, added.results[0].id);
  assert.ok(hits[0].score > 0.2 && 'created_at' in hits[0] && 'hash' in hits[0]);
  const all = parse(await direct('int-frutal', 'list_memories'));
  assert.deepEqual(all.map((m) => m.memory), [SSH]);
});

test('no duplica: una lección equivalente devuelve la existente (NONE) y no agrega nada', async () => {
  const before = points.length;
  const again = parse(await direct('int-frutal', 'add_memories', { text: `${SSH}.` }));
  assert.equal(again.results[0].event, 'NONE');
  assert.equal(points.length, before);
});

test('rechaza lo que no sirve con un motivo, sin guardar nada', async () => {
  const before = points.length;
  await assert.rejects(direct('int-frutal', 'add_memories', { text: 'Evitar errores de carga' }), /mcp_tool_error/);
  await assert.rejects(direct('int-frutal', 'add_memories', { text: 'La contraseña: Sup3rSecreta!2026 de la base de datos' }), /mcp_tool_error/);
  assert.equal(points.length, before);
});

test('aislamiento: un namespace nunca ve, borra ni lista lo de otro', async () => {
  const other = parse(await direct('proy-omniapos', 'add_memories', { text: 'El catálogo se sincroniza únicamente al abrir turno en la terminal' }));
  assert.deepEqual(parse(await direct('int-frutal', 'search_memory', { query: 'catálogo abrir turno terminal' })).map((h) => h.id).filter((id) => id === other.results[0].id), []);
  assert.equal((parse(await direct('proy-omniapos', 'list_memories'))).length, 1);
  await assert.rejects(direct('int-frutal', 'delete_memory', { memory_id: other.results[0].id }), /mcp_tool_error/, 'un id de otro namespace no se borra');
  assert.ok(points.some((p) => p.id === other.results[0].id));
});

test('delete_memory borra una; delete_all solo el namespace pedido', async () => {
  const extra = parse(await direct('zz-borrar', 'add_memories', { text: 'Esta lección de prueba existe solo para comprobar el borrado individual' }));
  await direct('zz-borrar', 'add_memories', { text: 'Otra lección distinta de prueba para comprobar que el borrado total funciona bien' });
  assert.equal(parse(await direct('zz-borrar', 'delete_memory', { memory_id: extra.results[0].id })).message, 'Memoria borrada');
  assert.equal(parse(await direct('zz-borrar', 'list_memories')).length, 1);
  assert.match(parse(await direct('zz-borrar', 'delete_all_memories')).message, /Se borraron 1 /);
  assert.equal(parse(await direct('zz-borrar', 'list_memories')).length, 0);
  assert.ok(points.some((p) => p.payload.user_id === 'int-frutal'), 'lo de otros namespaces sigue');
});

test('seguridad del servicio interno: sin secreto o con namespace invalido no se abre sesion', async () => {
  for (const [token, ns, code] of [[undefined, 'int-frutal', 401], ['mal', 'int-frutal', 401], [SECRET, 'Mayus!', 400], [SECRET, '../x', 404]]) {
    const status = await new Promise((resolve) => {
      const r = http.get({ port: memPort, host: '127.0.0.1', path: `/mcp/claude/sse/${ns}`, headers: token ? { authorization: `Bearer ${token}` } : {} }, (res) => { resolve(res.statusCode); res.destroy(); });
      r.on('error', () => resolve(0));
    });
    assert.equal(status, code, `${token}/${ns}`);
  }
});

test('si el servicio de embeddings cae, la herramienta responde con error y no deja nada a medias', async () => {
  const before = points.length;
  embedMode = 'down';
  await assert.rejects(direct('int-frutal', 'add_memories', { text: 'Una lección nueva y distinta mientras el servicio de embeddings está caído' }), /mcp_tool_error/);
  await assert.rejects(direct('int-frutal', 'search_memory', { query: 'cualquier cosa' }), /mcp_tool_error/);
  embedMode = 'ok';
  assert.equal(points.length, before);
  assert.ok(logs.some((l) => l.ev === 'memoria_error'));
  assert.equal(parse(await direct('int-frutal', 'list_memories')).length >= 1, true, 'y se recupera sola');
});

// ---------- integracion con el gateway ----------

test('gateway: el miembro escribe en su espacio (queda su autor), no entra a otros, y solo lectura no escribe ni borra', async () => {
  const mine = parse(await viaGateway(MEM, 'int-frutal', 'add_memories', { text: 'Un incidente real mostró que omitir el frontend deja nginx con la IP vieja de Docker' }));
  assert.equal(mine.results[0].event, 'ADD');
  assert.equal(points.find((p) => p.id === mine.results[0].id).payload.author, 'mem', 'el gateway pasa quien escribe');
  assert.equal(parse(await viaGateway(LEC, 'int-frutal', 'search_memory', { query: 'nginx IP vieja Docker frontend' }))[0].id, mine.results[0].id, 'solo lectura sí lee');
  await assert.rejects(viaGateway(MEM, 'cli-weritas', 'list_memories'), /mcp_http_403/, 'otro espacio: denegado en la conexion');
  await assert.rejects(viaGateway(LEC, 'int-frutal', 'add_memories', { text: 'Una lección que una persona de solo lectura no debería poder escribir' }, 2500), /mcp_timeout/);
  await assert.rejects(viaGateway(LEC, 'int-frutal', 'delete_memory', { memory_id: mine.results[0].id }, 2500), /mcp_timeout/);
  await assert.rejects(viaGateway(MEM, 'int-frutal', 'delete_all_memories', {}, 2500), /mcp_timeout/, 'borrar todo sigue siendo solo admin');
  assert.equal(parse(await viaGateway(MEM, 'int-frutal', 'delete_memory', { memory_id: mine.results[0].id })).message, 'Memoria borrada', 'el miembro sí borra una de su espacio');
});
