// node --test memory/access
// Lector de notas y grafo: permisos por espacio, cliente MCP real contra un Basic Memory falso.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGateway, hashToken } from './server.mjs';
import { createStore } from './users.mjs';

const ADM = 'omnia_adm_token_0123456789abcdef';
const MEM = 'omnia_mem_token_0123456789abcdef'; // miembro: int-frutal
const LEC = 'omnia_lec_token_0123456789abcdef'; // lectura: proy-omniapos
const CLI = 'omnia_cli_token_0123456789abcdef'; // cliente: cli-frutal

const PROJECTS = ['global', 'int-frutal', 'proy-omniapos', 'cli-frutal', 'cli-weritas', 'legacy projects'];
const NOTE = { title: 'Nota', permalink: 'nota-1', file_path: 'a/nota-1.md', content: '# Hola\n\n<script>alert(1)</script>', frontmatter: { type: 'note' } };
let upstream, upPort, gw, port, calls, memoriesRequests, scrolls, restBroken = false;

const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

function fakeBackend() {
  const sessions = new Map();
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/collections/openmemory/points/scroll') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const q = JSON.parse(body);
        scrolls.push(q);
        const user = q.filter.must[0].match.value;
        const page = q.offset === 'p2' ? 2 : 1;
        const points = Array.from({ length: page === 1 ? 100 : 3 }, (_, i) => ({ id: `m${page}-${i}`, payload: { data: `memoria ${page}-${i}`, user_id: user, created_at: '2026-09-01T00:00:00Z' } }));
        if (page === 2) points.push({ id: 'ajena', payload: { data: 'de otro espacio', user_id: 'cli-weritas' } }); // simula un filtro roto
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ result: { points, next_page_offset: page === 1 ? 'p2' : null } }));
      });
      return;
    }
    if (url.pathname === '/api/v1/memories/') {
      memoriesRequests.push({ user: url.searchParams.get('user_id'), auth: req.headers.authorization });
      if (restBroken) { res.writeHead(500); return res.end(); }
      const items = url.searchParams.get('page') === '1' ? [{ id: 'm1-0', categories: ['infra'], app_name: 'claude' }] : [];
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ items, total: 1, page: 1, size: 100, pages: 1 }));
    }
    if (req.method === 'GET' && url.pathname === '/mcp') {
      const sid = Math.random().toString(16).slice(2);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`event: endpoint\r\ndata: /messages/?session_id=${sid}\r\n\r\n`);
      sessions.set(sid, res);
      req.on('close', () => sessions.delete(sid));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/messages/') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const m = JSON.parse(body);
        const sse = sessions.get(url.searchParams.get('session_id'));
        res.writeHead(202); res.end('ok');
        if (!sse || m.id === undefined) return;
        const answer = (result) => sse.write(`event: message\r\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: m.id, result })}\r\n\r\n`);
        if (m.method === 'initialize') return answer({ protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake' } });
        const { name, arguments: a } = m.params;
        calls.push({ name, args: a, auth: req.headers.authorization });
        const text = (v) => answer({ content: [{ type: 'text', text: JSON.stringify({ result: v }) }] });
        if (name === 'list_memory_projects') return text({ projects: PROJECTS.map((p) => ({ name: p })) });
        if (name === 'list_directory') return text({ nodes: [{ type: 'directory', name: 'a' }, { type: 'file', title: 'Nota', permalink: 'nota-1', file_path: 'a/nota-1.md', note_type: 'note', updated_at: '2026-09-01T00:00:00Z' }], has_more: false });
        if (name === 'read_note') return a.identifier === 'nota-1' ? text(NOTE) : text(null);
        return answer({ isError: true, content: [{ type: 'text', text: 'x' }] });
      });
      return;
    }
    res.writeHead(404); res.end();
  });
}

before(async () => {
  calls = []; memoriesRequests = []; scrolls = [];
  upstream = fakeBackend();
  upPort = await listen(upstream);
  gw = createGateway({
    store: createStore({
      envText: `mem:${hashToken(MEM)}:miembro:int-frutal,lec:${hashToken(LEC)}:lectura:proy-omniapos,cli:${hashToken(CLI)}:cliente:cli-frutal`,
      adminsText: `adm:${hashToken(ADM)}`,
    }),
    routes: [
      { name: 'mem0', hosts: ['mem.test'], upstream: `http://127.0.0.1:${upPort}`, upstreamAuth: 'Bearer secreto-mem0', allow: ['/mcp/'] },
      { name: 'knowledge', hosts: ['kb.test'], upstream: `http://127.0.0.1:${upPort}`, upstreamAuth: 'Basic c2VjcmV0bw==', allow: ['/'] },
      { name: 'panel', hosts: ['panel.test'], upstream: '', allow: [] },
    ],
    viewerOptions: { qdrantUrl: `http://127.0.0.1:${upPort}` },
    enforce: true,
  });
  port = await listen(gw);
});
after(() => { gw.closeAllConnections?.(); gw.close(); upstream.closeAllConnections?.(); upstream.close(); });

const api = (p, token) => new Promise((resolve, reject) => {
  const req = http.request({ port, host: '127.0.0.1', path: p, method: 'GET', headers: { host: 'panel.test', authorization: `Bearer ${token}` } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch { /* texto */ } resolve({ status: res.statusCode, body: j, text: d }); });
  });
  req.on('error', reject);
  req.end();
});
const names = (r) => r.body.projects.map((p) => p.name);

test('proyectos: cada rol ve solo los espacios que le tocan (el admin ve todos, incluso los aun sin migrar)', async () => {
  assert.deepEqual(names(await api('/api/notes/projects', ADM)), PROJECTS);
  assert.deepEqual(names(await api('/api/notes/projects', MEM)), ['global', 'int-frutal']);
  assert.deepEqual(names(await api('/api/notes/projects', LEC)), ['global', 'proy-omniapos']);
  assert.deepEqual(names(await api('/api/notes/projects', CLI)), ['cli-frutal'], 'un cliente solo ve el suyo, ni siquiera el global');
  const lec = await api('/api/notes/projects', LEC);
  assert.deepEqual(lec.body.projects.map((p) => p.access), ['r', 'r']);
  assert.equal((await api('/api/notes/projects', 'omnia_falso')).status, 401);
});

test('el servidor habla con Basic Memory con SUS credenciales, nunca con las de la persona', async () => {
  await api('/api/notes/projects', MEM);
  assert.ok(calls.length > 0);
  for (const c of calls) assert.equal(c.auth, 'Basic c2VjcmV0bw==');
});

test('arbol y nota: se leen en un espacio permitido y se niegan en cualquier otro', async () => {
  const t = await api('/api/notes/tree?project=int-frutal', MEM);
  assert.equal(t.status, 200);
  assert.deepEqual(t.body.notes.map((n) => n.permalink), ['nota-1'], 'solo archivos, sin carpetas');
  const n = await api('/api/notes/note?project=int-frutal&id=nota-1', MEM);
  assert.equal(n.status, 200);
  assert.match(n.body.content, /# Hola/);
  for (const p of ['/api/notes/tree?project=cli-frutal', '/api/notes/tree?project=proy-omniapos', '/api/notes/tree?project=legacy%20projects', '/api/notes/note?project=cli-weritas&id=nota-1']) {
    assert.equal((await api(p, MEM)).status, 404, `${p} debe estar vedado para un miembro de int-frutal`);
  }
  assert.equal((await api('/api/notes/tree?project=int-frutal', CLI)).status, 404, 'el cliente no ve espacios internos');
  assert.equal((await api('/api/notes/tree?project=cli-frutal', CLI)).status, 200);
  assert.equal((await api('/api/notes/tree?project=legacy%20projects', ADM)).status, 200);
});

test('una nota no puede apuntar a otro proyecto con memory:// ni colar parametros', async () => {
  const before = calls.length;
  for (const id of ['memory://cli-weritas/secreto', 'MEMORY://cli-weritas/x', '']) {
    assert.equal((await api(`/api/notes/note?project=int-frutal&id=${encodeURIComponent(id)}`, MEM)).status, 400);
  }
  assert.equal((await api('/api/notes/note?project=int-frutal', MEM)).status, 400);
  assert.equal(calls.length, before, 'ni siquiera se llamo al origen');
  assert.equal((await api('/api/notes/note?project=int-frutal&id=no-existe', MEM)).status, 404);
  const last = calls.filter((c) => c.name === 'read_note').pop();
  assert.equal(last.args.project, 'int-frutal', 'el proyecto lo fija el servidor');
  assert.ok(!('project_id' in last.args) && !('workspace' in last.args) && !('search_all_projects' in last.args));
});

test('solo lectura: el lector no acepta escrituras', async () => {
  const r = await new Promise((resolve) => {
    const req = http.request({ port, host: '127.0.0.1', path: '/api/notes/projects', method: 'POST', headers: { host: 'panel.test', authorization: `Bearer ${ADM}`, 'content-length': 0 } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.end();
  });
  assert.equal(r, 405);
});

test('grafo: lista de espacios por rol y memorias solo del espacio permitido (global = omnia-global)', async () => {
  const sp = async (t) => (await api('/api/graph/spaces', t)).body.spaces;
  assert.deepEqual(await sp(MEM), ['global', 'int-frutal']);
  assert.deepEqual(await sp(CLI), ['cli-frutal']);
  assert.ok((await sp(ADM)).includes('proy-omniapos'));

  memoriesRequests.length = 0; scrolls.length = 0;
  const g = await api('/api/graph?space=int-frutal', MEM);
  assert.equal(g.status, 200);
  assert.equal(g.body.total, 103, 'recorre las paginas de Qdrant y descarta lo de otro namespace');
  assert.ok(!g.body.memories.some((m) => m.id === 'ajena'), 'un punto ajeno nunca sale, aunque el filtro fallara');
  assert.ok(scrolls.length === 2 && scrolls.every((q) => q.filter.must[0].key === 'user_id' && q.filter.must[0].match.value === 'int-frutal'), 'Qdrant se consulta SIEMPRE filtrado por el namespace del espacio');
  const withCats = g.body.memories.find((m) => m.id === 'm1-0');
  assert.deepEqual(withCats.categories, ['infra'], 'las categorias vienen de la REST cuando existen');
  assert.deepEqual(g.body.memories.find((m) => m.id === 'm1-1').categories, []);
  assert.ok(memoriesRequests.every((r) => r.user === 'int-frutal' && r.auth === 'Bearer secreto-mem0'));
  restBroken = true;
  assert.equal((await api('/api/graph?space=int-frutal', MEM)).body.total, 103, 'si la REST falla, el grafo sigue con los textos');
  restBroken = false;
  assert.equal((await api('/api/graph?space=cli-weritas', MEM)).status, 404);
  assert.equal((await api('/api/graph?space=global', CLI)).status, 404);
  assert.equal((await api('/api/graph?space=../x', ADM)).status, 404, 'espacio mal formado');
  scrolls.length = 0;
  await api('/api/graph?space=global', ADM);
  assert.equal(scrolls[0].filter.must[0].match.value, 'omnia-global');
});

test('si el origen cae responde 502 sin filtrar detalles', async () => {
  const dead = http.createServer(); const p = await listen(dead); dead.close();
  const gw2 = createGateway({
    store: createStore({ adminsText: `adm:${hashToken(ADM)}` }),
    routes: [{ name: 'knowledge', hosts: ['kb.test'], upstream: `http://127.0.0.1:${p}`, allow: ['/'] }, { name: 'panel', hosts: ['panel.test'], upstream: '', allow: [] }],
    enforce: true,
  });
  const port2 = await listen(gw2);
  const r = await new Promise((resolve) => {
    http.get({ port: port2, host: '127.0.0.1', path: '/api/notes/projects', headers: { host: 'panel.test', authorization: `Bearer ${ADM}` } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, text: d }));
    });
  });
  gw2.close();
  assert.equal(r.status, 502);
  assert.equal(r.text.includes('127.0.0.1'), false);
});
