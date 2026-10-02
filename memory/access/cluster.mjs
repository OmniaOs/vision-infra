// Organiza memorias por TEMA a partir de sus embeddings (los que Mem0 ya guarda en Qdrant): k-means por similitud
// coseno, nombre de cada tema con sus palabras mas distintivas y enlaces entre memorias muy parecidas.
// Determinista (misma entrada = misma salida), sin dependencias y sin llamar a ningun modelo.

const STOP = new Set(`de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre
cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes
algunos que unos yo otro otras otra el tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros es son fue ser
sido tiene tienen hace hacer debe deben puede pueden cada solo nunca siempre cualquier ejemplo the and for are not with that this from you your
tags when use used using into per vez equipo decidio estado fecha`.split(/\s+/));

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const normalize = (v) => { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return v.map((x) => x / n); };

function kmeans(vectors, k) {
  const random = rng(42);
  const centroids = [vectors[Math.floor(random() * vectors.length)]];
  while (centroids.length < k) { // k-means++: el siguiente centro, lejos de los ya elegidos
    const dist = vectors.map((v) => Math.max(0, 1 - Math.max(...centroids.map((c) => dot(v, c)))) ** 2);
    const total = dist.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let pick = random() * total; let idx = 0;
    while (idx < dist.length - 1 && (pick -= dist[idx]) > 0) idx++;
    centroids.push(vectors[idx]);
  }
  let assign = new Array(vectors.length).fill(0);
  for (let iter = 0; iter < 25; iter++) {
    const next = vectors.map((v) => { let best = 0; let bs = -2; centroids.forEach((c, i) => { const s = dot(v, c); if (s > bs) { bs = s; best = i; } }); return best; });
    const changed = next.some((x, i) => x !== assign[i]);
    assign = next;
    centroids.forEach((_, ci) => {
      const members = vectors.filter((_, i) => assign[i] === ci);
      if (members.length) centroids[ci] = normalize(members[0].map((_, d) => members.reduce((s, m) => s + m[d], 0)));
    });
    if (!changed && iter > 0) break;
  }
  return assign;
}

const words = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z][a-z0-9_-]{3,}/g) || [];

/** Nombre de cada tema: las palabras mas frecuentes en el y poco frecuentes en los demas (TF-IDF por grupo). */
function labelClusters(groups) {
  const tf = groups.map((g) => { const m = new Map(); for (const text of g) for (const w of new Set(words(text))) if (!STOP.has(w)) m.set(w, (m.get(w) || 0) + 1); return m; });
  const df = new Map();
  for (const m of tf) for (const w of m.keys()) df.set(w, (df.get(w) || 0) + 1);
  return tf.map((m, i) => {
    const scored = [...m].map(([w, c]) => [w, c * Math.log((groups.length + 1) / (df.get(w) + 0.5)) * (c >= 2 ? 1.5 : 1)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = scored.slice(0, 3).map(([w]) => w);
    return top.length ? top.join(' · ') : `Tema ${i + 1}`;
  });
}

/**
 * @param items [{ id, content, vector? }]
 * @returns { clusters: [{id,label,size}], assignment: {id: clusterId}, links: [[idA, idB, similitud]] }
 * Las memorias sin vector quedan sin tema (`assignment[id]` ausente).
 */
export function analyzeMemories(items, { maxClusters = 10, neighbors = 2, minSimilarity = 0.5, maxLinks = 1500 } = {}) {
  const withVec = items.filter((m) => Array.isArray(m.vector) && m.vector.length > 0);
  if (withVec.length < 2) return { clusters: [], assignment: {}, links: [] };
  const dim = withVec[0].vector.length;
  const usable = withVec.filter((m) => m.vector.length === dim);
  const vectors = usable.map((m) => normalize(m.vector));

  const k = usable.length < 4 ? 1 : Math.min(maxClusters, Math.max(2, Math.round(Math.sqrt(usable.length / 2))));
  const raw = k === 1 ? new Array(usable.length).fill(0) : kmeans(vectors, k);
  const used = [...new Set(raw)].sort((a, b) => raw.filter((x) => x === b).length - raw.filter((x) => x === a).length || a - b);
  const order = new Map(used.map((c, i) => [c, i]));
  const groups = used.map((c) => usable.filter((_, i) => raw[i] === c).map((m) => m.content));
  const labels = labelClusters(groups);
  // Dos grupos con exactamente el mismo nombre son el mismo tema partido en dos por k-means: se fusionan.
  const firstWith = new Map();
  const merged = labels.map((label, i) => { if (!firstWith.has(label)) firstWith.set(label, i); return firstWith.get(label); });
  const kept = [...new Set(merged)];
  const finalIndex = new Map(kept.map((old, i) => [old, i]));
  const clusters = kept.map((old, i) => ({ id: `c${i}`, label: labels[old], size: merged.reduce((n, m, gi) => (m === old ? n + groups[gi].length : n), 0) }));
  const assignment = Object.fromEntries(usable.map((m, i) => [m.id, `c${finalIndex.get(merged[order.get(raw[i])])}`]));

  const seen = new Set(); const links = [];
  vectors.forEach((v, i) => {
    const sims = [];
    for (let j = 0; j < vectors.length; j++) if (j !== i) sims.push([j, dot(v, vectors[j])]);
    sims.sort((a, b) => b[1] - a[1]);
    for (const [j, s] of sims.slice(0, neighbors)) {
      if (s < minSimilarity) break;
      const key = i < j ? `${i}|${j}` : `${j}|${i}`;
      if (!seen.has(key)) { seen.add(key); links.push([usable[i].id, usable[j].id, Math.round(s * 1000) / 1000]); }
    }
  });
  return { clusters, assignment, links: links.slice(0, maxLinks) };
}
