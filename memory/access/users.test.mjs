// node --test memory/access
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hashToken, parseUsers, saveStoreFile, createStore, TOKEN_LIMIT } from './users.mjs';

const H = (s) => hashToken(s);
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-users-'));
// Archivo en el formato v1 (un `hash` por persona): el que ya existe en produccion.
const saveUsersFile = (file, users) => writeFileSync(file, JSON.stringify({ version: 1, users }));

test('parseUsers: formato antiguo y extendido', () => {
  const u = parseUsers(`daniel:${H('a')}\nana:${H('b')}:miembro:int-frutal+proy-omniapos,ce:${H('c')}:cliente:cli-frutal\n# nota`);
  assert.deepEqual(u.map((x) => [x.id, x.role, x.spaces]), [
    ['daniel', 'miembro', []], ['ana', 'miembro', ['int-frutal', 'proy-omniapos']], ['ce', 'cliente', ['cli-frutal']],
  ]);
  assert.equal(parseUsers(`root:${H('r')}`, { forceRole: 'admin' })[0].role, 'admin');
});

test('parseUsers: rechaza lo invalido en vez de aceptar a nadie o a todos', () => {
  assert.throws(() => parseUsers('ana:noeshash'), /linea invalida/);
  assert.throws(() => parseUsers(`ana:${H('a')}:jefe`), /rol invalido/);
  assert.throws(() => parseUsers(`ana:${H('a')}:miembro:Frutal`), /linea invalida|espacio invalido/);
  assert.throws(() => parseUsers(`ce:${H('a')}:cliente:int-frutal`), /solo puede tener espacios cli-/);
  assert.throws(() => parseUsers(`ce:${H('a')}:cliente`), /al menos un espacio/);
  assert.equal(parseUsers('').length, 0);
});

test('store: el archivo manda sobre el rol del env, los tokens se suman y ACCESS_ADMINS siempre es admin', () => {
  const file = path.join(dir, 'a.json');
  saveUsersFile(file, [{ id: 'ana', hash: H('nuevo'), role: 'lectura', spaces: ['int-frutal'] }]);
  const s = createStore({
    envText: `ana:${H('viejo')}:miembro\nluis:${H('l')}`,
    adminsText: `root:${H('r')}`, file,
  });
  assert.equal(s.lookup(H('viejo')).role, 'lectura', 'el token de Coolify sigue sirviendo, con el rol del archivo');
  assert.equal(s.lookup(H('nuevo')).role, 'lectura');
  assert.notEqual(s.lookup(H('viejo')).tokenId, s.lookup(H('nuevo')).tokenId);
  assert.equal(s.lookup(H('l')).id, 'luis');
  assert.equal(s.lookup(H('r')).role, 'admin');
});

test('store: relee el archivo al cambiar, y una baja deja de servir', () => {
  const file = path.join(dir, 'b.json');
  saveUsersFile(file, [{ id: 'ana', hash: H('t'), role: 'miembro', spaces: [] }]);
  const s = createStore({ file });
  assert.equal(s.lookup(H('t')).id, 'ana');
  saveUsersFile(file, [{ id: 'ana', hash: H('t'), role: 'miembro', spaces: [], active: false }]);
  const later = new Date(Date.now() + 5000);
  utimesSync(file, later, later);
  s.refresh(Date.now() + 5000);
  assert.equal(s.lookup(H('t')), null);
});

test('store: un archivo roto no tumba el servicio ni cambia el estado', () => {
  const file = path.join(dir, 'c.json');
  saveUsersFile(file, [{ id: 'ana', hash: H('t'), role: 'miembro', spaces: [] }]);
  const logs = [];
  const s = createStore({ file, log: (e) => logs.push(e) });
  writeFileSync(file, '{ roto');
  const later = new Date(Date.now() + 9000);
  utimesSync(file, later, later);
  s.refresh(Date.now() + 9000);
  assert.equal(s.lookup(H('t')).id, 'ana');
  assert.ok(logs.some((l) => l.ev === 'usuarios_error_recarga'));
});

test('saveStoreFile valida antes de escribir', () => {
  assert.throws(() => saveStoreFile(path.join(dir, 'd.json'), { users: [{ id: 'x', role: 'dios', spaces: [] }] }), /rol invalido/);
});

test('store: si el archivo desaparece no se reconstruye en cada consulta', () => {
  const file = path.join(dir, 'e.json');
  saveUsersFile(file, [{ id: 'ana', hash: H('t'), role: 'miembro', spaces: [] }]);
  const logs = [];
  const s = createStore({ envText: `luis:${H('l')}`, file, log: (e) => logs.push(e) });
  rmSync(file);
  for (let i = 1; i <= 5; i++) s.refresh(Date.now() + i * 2000);
  assert.equal(logs.filter((l) => l.ev === 'usuarios_recargados').length, 1, 'una sola recarga');
  assert.equal(s.lookup(H('l')).id, 'luis');
});

// ---------- tokens ----------

const mk = (name, env = {}) => createStore({ file: path.join(dir, `${name}.json`), ...env });
const create = (s, id, tok, extra = {}) => s.createFileUser({ id, role: 'miembro', spaces: ['int-frutal'], ...extra }, H(tok), { createdBy: 'adm' });

test('un archivo v1 se migra solo: cada hash pasa a ser un token con nombre', () => {
  const file = path.join(dir, 'v1.json');
  saveUsersFile(file, [{ id: 'ana', hash: H('t'), role: 'miembro', spaces: [], createdAt: '2026-09-01T00:00:00.000Z' }]);
  const s = createStore({ file });
  assert.equal(s.lookup(H('t')).id, 'ana');
  const [t] = s.tokensOf('ana');
  assert.equal(t.label, 'Token inicial');
  assert.equal(t.managed, true);
  s.addToken('ana', H('otro'), { label: 'Portatil' }); // la primera escritura lo deja en v2
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(raw.version, 2);
  assert.ok(!raw.users[0].hash, 'el hash ya no vive en la persona');
  assert.equal(raw.tokens.length, 2);
  assert.equal(createStore({ file }).lookup(H('t')).id, 'ana', 'sobrevive a recargar');
});

test('varios tokens por persona: todos sirven y revocar uno no afecta a los demas', () => {
  const s = mk('multi');
  create(s, 'ana', 'a1');
  const t2 = s.addToken('ana', H('a2'), { label: 'Laptop de casa', createdBy: 'ana' });
  assert.equal(s.lookup(H('a1')).id, 'ana');
  assert.equal(s.lookup(H('a2')).tokenId, t2.tid);
  assert.deepEqual(s.revokeToken(t2.tid), { userId: 'ana' });
  assert.equal(s.lookup(H('a2')), null, 'el revocado deja de servir al instante');
  assert.equal(s.lookup(H('a1')).id, 'ana');
  const list = s.tokensOf('ana');
  assert.equal(list.length, 2);
  assert.ok(list.find((t) => t.tid === t2.tid).revokedAt, 'queda como historial, marcado revocado');
  assert.equal(list[0].revokedAt, null, 'los activos van primero');
});

test('un token de Coolify se ve y NO se revoca desde aqui, pero la persona puede tener tokens del portal', () => {
  const s = mk('env', { envText: `luis:${H('l')}:lectura:int-frutal`, adminsText: `root:${H('r')}` });
  const [e] = s.tokensOf('luis');
  assert.deepEqual([e.origin, e.managed, e.tid], ['env', false, 'env:luis']);
  assert.deepEqual(s.revokeToken('env:luis'), { error: 'gestionado_en_coolify' });
  assert.deepEqual(s.revokeToken('nada'), { error: 'no_existe' });
  const t = s.addToken('luis', H('l2'), { label: 'Portal' });
  assert.equal(s.lookup(H('l2')).role, 'lectura', 'mantiene rol y espacios');
  assert.deepEqual(s.lookup(H('l2')).spaces, ['int-frutal']);
  assert.equal(s.lookup(H('l')).id, 'luis', 'el de Coolify sigue sirviendo');
  s.addToken('root', H('r2'), { label: 'Portal' });
  assert.equal(s.lookup(H('r2')).role, 'admin');
  assert.equal(s.tokensOf('root').length, 2);
  s.revokeToken(t.tid);
  assert.equal(s.lookup(H('l2')), null);
});

test('un token nuevo en ACCESS_ADMINS no deja fuera al token anterior de la misma persona', () => {
  const s = createStore({ envText: `daniel:${H('viejo')}:miembro`, adminsText: `daniel:${H('nuevo')}` });
  assert.equal(s.lookup(H('viejo')).role, 'admin');
  assert.equal(s.lookup(H('nuevo')).role, 'admin');
  assert.equal(s.tokensOf('daniel').length, 2);
});

test('ultimo uso: se anota, se limpia y se guarda en disco', () => {
  const file = path.join(dir, 'uso.json');
  let clock = Date.parse('2026-10-01T10:00:00Z');
  const s = createStore({ file, now: () => clock });
  create(s, 'ana', 'a1', { spaces: [] });
  assert.equal(s.tokensOf('ana')[0].lastUsedAt, null);
  clock += 60000;
  s.touch(s.lookup(H('a1')), { ip: '203.0.113.9', agent: 'claude-code/1.0\r\nX-Evil: 1' });
  const t = s.tokensOf('ana')[0];
  assert.equal(t.lastUsedAt, '2026-10-01T10:01:00.000Z');
  assert.equal(t.lastIp, '203.0.113.9');
  assert.ok(!/[\r\n]/.test(t.lastDevice), 'sin saltos de linea en el dispositivo');
  s.flushUsage();
  assert.equal(createStore({ file }).tokensOf('ana')[0].lastIp, '203.0.113.9', 'persistido');
  // Un token de Coolify solo vive en memoria.
  const e = createStore({ envText: `luis:${H('l')}` });
  e.touch(e.lookup(H('l')), { ip: '198.51.100.2', agent: 'curl' });
  assert.equal(e.tokensOf('luis')[0].lastIp, '198.51.100.2');
});

test('limite de tokens activos por persona; los revocados no cuentan', () => {
  const s = mk('limite');
  create(s, 'ana', 'x0');
  for (let i = 1; i < TOKEN_LIMIT; i++) s.addToken('ana', H(`x${i}`), { label: `t${i}` });
  assert.throws(() => s.addToken('ana', H('de-mas'), { label: 'x' }), /limite_de_tokens/);
  s.revokeToken(s.tokensOf('ana').find((t) => !t.revokedAt).tid);
  s.addToken('ana', H('cabe'), { label: 'x' });
  assert.throws(() => s.addToken('nadie', H('z'), { label: 'x' }), /no_existe/);
});

test('revocar todos los tokens del portal de una persona; la baja se lleva sus tokens', () => {
  const s = mk('todos', { envText: `luis:${H('l')}` });
  create(s, 'ana', 'a1');
  s.addToken('ana', H('a2'), { label: 'dos' });
  assert.equal(s.revokeUserTokens('ana'), 2);
  assert.equal(s.lookup(H('a1')), null);
  assert.equal(s.revokeUserTokens('ana'), 0);
  create(s, 'bea', 'b1');
  s.setFileUsers(s.fileUsers().filter((u) => u.id !== 'bea'));
  assert.equal(s.lookup(H('b1')), null);
  assert.equal(s.tokensOf('bea').length, 0);
});

test('migrar a una persona de ACCESS_DEVS al portal conserva su mismo token', () => {
  const s = mk('adopt', { envText: `emilio:${H('e')}:miembro:int-frutal` });
  assert.equal(s.byId('emilio').origin, 'env');
  assert.equal(s.adoptEnvUser('emilio'), true);
  assert.equal(s.byId('emilio').origin, 'file');
  assert.equal(s.lookup(H('e')).role, 'miembro');
  const mine = s.tokensOf('emilio');
  assert.equal(mine.length, 1, 'el mismo hash no se duplica');
  assert.equal(mine[0].managed, true);
  assert.equal(s.adoptEnvUser('emilio'), false, 'ya migrado');
  // Con la linea ya quitada de Coolify sigue funcionando.
  const sinCoolify = createStore({ file: path.join(dir, 'adopt.json') });
  assert.equal(sinCoolify.lookup(H('e')).id, 'emilio');
});
