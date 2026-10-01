// node --test memory/access
// Alias de namespaces antiguos de Mem0: se tratan como un espacio sin mover datos.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { access, checkMem0Connect, configureNamespaceAliases, mem0Namespace, spaceFromMem0 } from './policy.mjs';

beforeEach(() => configureNamespaceAliases(''));

const miembro = (...spaces) => ({ role: 'miembro', spaces });

test('sin alias todo sigue igual (compatibilidad)', () => {
  assert.equal(spaceFromMem0('vision-infra'), null);
  assert.equal(spaceFromMem0('omnia-global'), 'global');
  assert.equal(spaceFromMem0('int-frutal'), 'int-frutal');
  assert.equal(mem0Namespace('int-frutal'), 'int-frutal');
});

test('un alias hace que el namespace antiguo cuente como su espacio', () => {
  configureNamespaceAliases('vision-infra=proy-vision-infra, frutal = int-frutal');
  assert.equal(spaceFromMem0('vision-infra'), 'proy-vision-infra');
  assert.equal(mem0Namespace('proy-vision-infra'), 'vision-infra', 'el visor lee donde estan los datos');
  assert.equal(checkMem0Connect(miembro('proy-vision-infra'), 'vision-infra').ok, true);
  assert.equal(checkMem0Connect(miembro('int-frutal'), 'vision-infra').ok, false, 'otro espacio no entra');
  assert.equal(checkMem0Connect({ role: 'cliente', spaces: ['cli-frutal'] }, 'frutal').ok, false, 'un cliente no entra a un namespace interno');
  assert.equal(checkMem0Connect(miembro(), 'vision-infra').ok, false);
  assert.equal(access(miembro('int-frutal'), spaceFromMem0('frutal')), 'rw');
});

test('el nombre nuevo de un espacio con alias NO se puede usar: abriria un namespace vacio y aparte', () => {
  configureNamespaceAliases('vision-infra=proy-vision-infra');
  assert.equal(spaceFromMem0('proy-vision-infra'), null);
  assert.equal(checkMem0Connect(miembro('proy-vision-infra'), 'proy-vision-infra').ok, false);
  assert.equal(spaceFromMem0('proy-otro'), 'proy-otro', 'los demas espacios no cambian');
});

test('la configuracion invalida se rechaza en vez de abrir un hueco', () => {
  for (const bad of ['sin-igual', 'a=b=c', 'x=global', 'x=nombre-sin-prefijo', 'omnia-global=int-x', 'int-a=int-b', 'Mayus=int-x', 'x=int-a,y=int-a', 'x=int-a,x=int-b', '=int-a']) {
    assert.throws(() => configureNamespaceAliases(bad), /alias/, bad);
  }
  assert.equal(spaceFromMem0('x'), null, 'una configuracion rota no deja nada a medias');
  configureNamespaceAliases('# comentario\n\nvision-infra=proy-vision-infra\n');
  assert.equal(spaceFromMem0('vision-infra'), 'proy-vision-infra');
});
