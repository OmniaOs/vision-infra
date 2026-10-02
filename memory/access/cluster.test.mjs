// node --test memory/access
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMemories } from './cluster.mjs';

// Dos temas bien separados en un espacio de 4 dimensiones.
const A = (n) => [1, 0.05 * n, 0, 0];
const B = (n) => [0, 0, 1, 0.05 * n];
const items = [
  ...[1, 2, 3, 4, 5].map((n) => ({ id: `a${n}`, content: `Coolify exige dominio con esquema y puerto para traefik ${n}`, vector: A(n) })),
  ...[1, 2, 3, 4, 5].map((n) => ({ id: `b${n}`, content: `Los respaldos de qdrant se cifran con passphrase antes de subir ${n}`, vector: B(n) })),
];

test('separa por tema, nombra cada tema con sus palabras y enlaza vecinos del mismo tema', () => {
  const r = analyzeMemories(items);
  assert.equal(r.clusters.length, 2);
  const ca = r.assignment.a1; const cb = r.assignment.b1;
  assert.notEqual(ca, cb);
  for (const n of [1, 2, 3, 4, 5]) { assert.equal(r.assignment[`a${n}`], ca); assert.equal(r.assignment[`b${n}`], cb); }
  const labelA = r.clusters.find((c) => c.id === ca).label;
  const labelB = r.clusters.find((c) => c.id === cb).label;
  assert.match(labelA, /coolify|dominio|traefik|puerto|esquema/);
  assert.match(labelB, /respaldos|qdrant|passphrase|cifran|subir/);
  assert.ok(r.links.length > 0 && r.links.every(([x, y]) => x[0] === y[0]), 'solo se enlazan memorias parecidas (mismo tema)');
});

test('es determinista: la misma entrada da exactamente la misma salida', () => {
  assert.deepEqual(analyzeMemories(items), analyzeMemories(items));
});

test('casos limite: pocas memorias, sin vectores, vectores de otra dimension', () => {
  assert.deepEqual(analyzeMemories([]), { clusters: [], assignment: {}, links: [] });
  assert.deepEqual(analyzeMemories([{ id: 'x', content: 'a', vector: [1, 0] }]).clusters, []);
  assert.deepEqual(analyzeMemories([{ id: 'x', content: 'hola' }, { id: 'y', content: 'adios' }]).clusters, []);
  const few = analyzeMemories([{ id: 'x', content: 'uno dos', vector: [1, 0] }, { id: 'y', content: 'uno tres', vector: [0.9, 0.1] }, { id: 'z', content: 'raro', vector: [1, 2, 3] }]);
  assert.equal(few.clusters.length, 1, 'con menos de 4 memorias hay un solo tema');
  assert.ok(!('z' in few.assignment), 'un vector de otra dimension se ignora, no rompe');
});

test('escala: 500 memorias de 1536 dimensiones se organizan en menos de unos segundos', () => {
  const big = Array.from({ length: 500 }, (_, i) => ({ id: `m${i}`, content: `tema ${i % 7} palabra${i % 7} general`, vector: Array.from({ length: 1536 }, (_, d) => ((d % 7 === i % 7 ? 1 : 0) + ((i * 31 + d * 17) % 100) / 1000)) }));
  const t = Date.now();
  const r = analyzeMemories(big);
  assert.ok(Date.now() - t < 8000, `tardo ${Date.now() - t} ms`);
  assert.ok(r.clusters.length >= 2 && r.clusters.length <= 10);
  assert.equal(Object.keys(r.assignment).length, 500);
});

test('un tema partido en dos grupos con el mismo nombre se fusiona', () => {
  // Un solo tema muy homogeneo: k-means lo parte en varios grupos, pero todos se llamaran igual.
  const one = Array.from({ length: 12 }, (_, n) => ({ id: `x${n}`, content: 'Coolify exige dominio con esquema y puerto', vector: [1, 0.01 * n, 0, 0] }));
  const r = analyzeMemories(one);
  assert.equal(new Set(r.clusters.map((c) => c.label)).size, r.clusters.length, 'ningun nombre repetido');
  assert.equal(r.clusters.reduce((n, c) => n + c.size, 0), 12, 'ninguna memoria se pierde al fusionar');
  assert.equal(r.clusters.length, 1);
});
