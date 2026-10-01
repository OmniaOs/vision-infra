// node --test memory/access
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  access, validateUser, parseRpc, checkMem0Connect, checkMem0Rpc, checkKbRpc,
  spaceFromMem0, mem0Namespace,
} from './policy.mjs';

const admin = { id: 'adm', role: 'admin', spaces: [] };
const ana = { id: 'ana', role: 'miembro', spaces: ['int-frutal', 'proy-omniapos'] };
const leo = { id: 'leo', role: 'lectura', spaces: ['int-frutal'] };
const cli = { id: 'frutal-ceo', role: 'cliente', spaces: ['cli-frutal'] };

const call = (name, args = {}) => [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }];
const kb = (u, name, args) => checkKbRpc(u, call(name, args));
const mem = (u, space, name) => checkMem0Rpc(u, space, call(name, {}));

test('acceso por rol y espacio', () => {
  assert.equal(access(admin, 'int-lo-que-sea'), 'rw');
  assert.equal(access(ana, 'global'), 'rw');
  assert.equal(access(ana, 'int-frutal'), 'rw');
  assert.equal(access(ana, 'int-weritas'), null);
  assert.equal(access(ana, 'cli-frutal'), null);
  assert.equal(access(leo, 'global'), 'r');
  assert.equal(access(leo, 'int-frutal'), 'r');
  assert.equal(access(cli, 'cli-frutal'), 'rw');
  assert.equal(access(cli, 'global'), null, 'el cliente no ve el global');
  assert.equal(access(cli, 'int-frutal'), null, 'el cliente no ve lo interno');
});

test('validacion de usuarios', () => {
  assert.equal(validateUser(ana), null);
  assert.match(validateUser({ ...ana, role: 'jefe' }), /rol invalido/);
  assert.match(validateUser({ ...ana, spaces: ['Frutal'] }), /espacio invalido/);
  assert.match(validateUser({ ...ana, spaces: ['global'] }), /implicito/);
  assert.match(validateUser({ ...cli, spaces: ['int-frutal'] }), /solo puede tener espacios cli-/);
  assert.match(validateUser({ ...cli, spaces: [] }), /al menos un espacio/);
  assert.match(validateUser({ ...ana, id: 'A B' }), /id invalido/);
});

test('Mem0: conexion por namespace', () => {
  assert.equal(spaceFromMem0('omnia-global'), 'global');
  assert.equal(mem0Namespace('global'), 'omnia-global');
  assert.equal(checkMem0Connect(ana, 'omnia-global').ok, true);
  assert.equal(checkMem0Connect(ana, 'int-frutal').ok, true);
  assert.equal(checkMem0Connect(ana, 'int-weritas').ok, false);
  assert.equal(checkMem0Connect(ana, 'frutal').reason, 'namespace_desconocido', 'nombres antiguos o inventados');
  assert.equal(checkMem0Connect(cli, 'cli-frutal').ok, true);
  assert.equal(checkMem0Connect(cli, 'omnia-global').ok, false);
  assert.equal(checkMem0Connect(admin, 'cualquier-cosa').ok, true);
});

test('Mem0: herramientas por rol', () => {
  assert.equal(mem(ana, 'int-frutal', 'add_memories').ok, true);
  assert.equal(mem(ana, 'int-frutal', 'delete_all_memories').reason, 'solo_admin');
  assert.equal(mem(admin, 'int-frutal', 'delete_all_memories').ok, true);
  assert.equal(mem(leo, 'int-frutal', 'search_memory').ok, true);
  assert.equal(mem(leo, 'int-frutal', 'add_memories').reason, 'solo_lectura');
  assert.equal(mem(ana, 'int-frutal', 'herramienta_nueva').ok, false);
  assert.equal(mem(cli, 'cli-frutal', 'add_memories').ok, true);
});

test('Mem0: una sesion no puede usar un espacio al que ya no tiene acceso', () => {
  assert.equal(mem(ana, 'int-weritas', 'search_memory').reason, 'sin_acceso_al_espacio');
});

test('JSON-RPC: invalido, lotes y metodos', () => {
  assert.equal(parseRpc('no es json').error, 'invalid_json');
  assert.equal(parseRpc('[]').error, 'invalid_rpc');
  assert.equal(parseRpc('[1]').error, 'invalid_rpc');
  assert.equal(parseRpc(JSON.stringify(Array(51).fill({ method: 'ping' }))).error, 'invalid_rpc');
  const batch = [{ method: 'ping' }, ...call('delete_all_memories')];
  assert.equal(checkMem0Rpc(ana, 'int-frutal', batch).ok, false, 'un lote no esconde una herramienta prohibida');
  assert.equal(checkMem0Rpc(ana, 'int-frutal', [{ method: 'resources/read', params: { uri: 'memory://x' } }]).ok, false);
  assert.equal(checkMem0Rpc(ana, 'int-frutal', [{ method: 'notifications/initialized' }]).ok, true);
  assert.equal(checkMem0Rpc(ana, 'int-frutal', [{ jsonrpc: '2.0', id: 3, result: {} }]).ok, true);
});

test('Basic Memory: caso normal permitido', () => {
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: 'incidentes/x' }).ok, true);
  assert.equal(kb(ana, 'write_note', { project: 'proy-omniapos', title: 't', content: 'c', directory: 'd' }).ok, true);
  assert.equal(kb(ana, 'search_notes', { project: 'global', query: 'q' }).ok, true);
  assert.equal(kb(cli, 'write_note', { project: 'cli-frutal', title: 't', content: 'c', directory: 'd' }).ok, true);
});

test('Basic Memory: las cuatro fugas verificadas en vivo quedan cerradas', () => {
  // A) omitir project + URL memory:// de otro proyecto
  assert.equal(kb(ana, 'read_note', { identifier: 'memory://int-weritas/x' }).reason, 'project_obligatorio');
  // A') con project propio pero URL de otro
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: 'memory://int-weritas/x' }).reason, 'url_memory_de_otro_proyecto');
  // B) build_context con URL de otro proyecto
  assert.equal(kb(ana, 'build_context', { project: 'int-frutal', url: 'memory://int-weritas/*' }).reason, 'url_memory_de_otro_proyecto');
  assert.equal(kb(ana, 'build_context', { project: 'int-frutal', url: 'memory://*' }).reason, 'url_memory_de_otro_proyecto');
  // C) busqueda en todos los proyectos
  assert.equal(kb(ana, 'search_notes', { project: 'int-frutal', query: 'q', search_all_projects: true }).reason, 'argumento_prohibido:search_all_projects');
  // D) project_id de otro proyecto
  assert.equal(kb(ana, 'list_directory', { project_id: '14b8772d-d507-4b22-a3b5-92e7c5f5999a', dir_name: '/' }).reason, 'argumento_prohibido:project_id');
  assert.equal(kb(ana, 'list_directory', { project: 'int-frutal', project_id: 'x' }).reason, 'argumento_prohibido:project_id');
});

test('Basic Memory: variantes de evasion', () => {
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: 'MEMORY://int-weritas/x' }).ok, false, 'mayusculas');
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: '  memory://int-weritas/x' }).ok, false, 'espacios');
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: 'memory://int%2Dweritas/x' }).ok, false, 'codificada');
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: 'memory://int-frutal%2e%2e/x' }).ok, false);
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: 'memory://%E0%A4%A' }).reason, 'url_memory_invalida');
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: '../int-weritas/x' }).reason, 'ruta_con_punto_punto');
  assert.equal(kb(ana, 'write_note', { project: 'int-frutal', title: 't', directory: '..\\int-weritas', content: 'c' }).ok, false);
  assert.equal(kb(ana, 'move_note', { project: 'int-frutal', identifier: 'a', destination_path: 'memory://int-weritas/b' }).ok, false);
  assert.equal(kb(ana, 'read_note', { project: 'int-frutal', identifier: { a: ['memory://int-weritas/x'] } }).ok, false, 'anidado');
  assert.equal(kb(ana, 'read_note', { project: ['int-frutal'], identifier: 'x' }).reason, 'project_obligatorio');
  assert.equal(kb(ana, 'read_note', { project: 'Int-Frutal', identifier: 'x' }).reason, 'proyecto_desconocido');
  assert.equal(kb(ana, 'read_note', 'texto').reason, 'argumentos_invalidos');
});

test('Basic Memory: herramientas sin alcance de proyecto estan bloqueadas para no admin', () => {
  for (const t of ['search', 'fetch', 'list_memory_projects', 'list_workspaces', 'create_memory_project',
    'delete_project', 'basic_memory_diagnostics', 'herramienta_nueva']) {
    assert.match(kb(ana, t, { project: 'int-frutal' }).reason, /herramienta_no_permitida/, t);
  }
  assert.equal(kb(admin, 'list_memory_projects', {}).ok, true);
  assert.equal(kb(admin, 'create_memory_project', { project_name: 'x', project_path: 'x' }).ok, true);
});

test('Basic Memory: roles y espacios', () => {
  assert.equal(kb(ana, 'read_note', { project: 'int-weritas', identifier: 'x' }).reason, 'sin_acceso_al_espacio');
  assert.equal(kb(leo, 'read_note', { project: 'int-frutal', identifier: 'x' }).ok, true);
  for (const w of ['write_note', 'edit_note', 'move_note', 'delete_note']) {
    assert.equal(kb(leo, w, { project: 'int-frutal', identifier: 'x', title: 't', content: 'c', directory: 'd', destination_path: 'y' }).reason, 'solo_lectura', w);
  }
  assert.equal(kb(cli, 'read_note', { project: 'int-frutal', identifier: 'x' }).reason, 'sin_acceso_al_espacio');
  assert.equal(kb(cli, 'read_note', { project: 'global', identifier: 'x' }).reason, 'sin_acceso_al_espacio');
  assert.equal(kb(cli, 'read_note', { project: 'cli-weritas', identifier: 'x' }).reason, 'sin_acceso_al_espacio');
});
