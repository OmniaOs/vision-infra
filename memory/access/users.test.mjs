// node --test memory/access
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hashToken, parseUsers, saveUsersFile, createStore } from './users.mjs';

const H = (s) => hashToken(s);
const dir = mkdtempSync(path.join(tmpdir(), 'omnia-users-'));

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

test('store: el archivo reemplaza al env por id, y ACCESS_ADMINS siempre manda', () => {
  const file = path.join(dir, 'a.json');
  saveUsersFile(file, [{ id: 'ana', hash: H('nuevo'), role: 'lectura', spaces: ['int-frutal'] }]);
  const s = createStore({
    envText: `ana:${H('viejo')}:miembro\nluis:${H('l')}`,
    adminsText: `root:${H('r')}`, file,
  });
  assert.equal(s.lookup(H('viejo')), null, 'el token viejo de ana deja de servir');
  assert.equal(s.lookup(H('nuevo')).role, 'lectura');
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

test('saveUsersFile valida antes de escribir', () => {
  assert.throws(() => saveUsersFile(path.join(dir, 'd.json'), [{ id: 'x', hash: H('a'), role: 'dios', spaces: [] }]), /rol invalido/);
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
