/**
 * distill.mjs — Convierte eventos crudos (commits/handoffs) en PROPUESTAS de
 * memoria estructuradas. Usa un LLM vía endpoint OpenAI-compatible (el gateway
 * de Omnia, con API key de PAGO — nunca suscripción, por ToS).
 *
 * En --dry-run (o sin API key) usa un destilador local naïve para poder probar
 * el pipeline sin red ni credenciales.
 */

const SYSTEM = `Eres Hermes, el bibliotecario de memoria del equipo Omnia.
A partir de commits y handoffs recientes, extrae LECCIONES DURABLES y DECISIONES
reutilizables entre repos y sesiones. Devuelve SOLO JSON: un array de objetos
{ "title": string, "body": string, "tags": string[], "sources": string[] }.
Reglas: nada de secretos ni credenciales; máximo 8 propuestas; cada una debe ser
útil dentro de 3 meses (no ruido efímero); body en 1-4 frases.`;

function naiveDistill(events) {
  // Agrupa por repo y produce una propuesta-resumen por repo (sin LLM).
  const byRepo = {};
  for (const e of events) (byRepo[e.repo] ||= []).push(e);
  return Object.entries(byRepo).map(([repo, evs]) => {
    const commits = evs.filter((e) => e.kind === 'commit');
    const subjects = commits.map((c) => `- ${c.subject}`).slice(0, 15).join('\n');
    return {
      title: `Actividad reciente en ${repo}`,
      body: `${commits.length} commit(s) nuevos en ${repo}. Revisar para lecciones durables.`,
      tags: ['auto', 'dry-run', repo],
      sources: commits.slice(0, 15).map((c) => `${repo}@${c.hash}`),
      raw: subjects,
    };
  });
}

async function llmDistill(events, { baseUrl, apiKey, model }) {
  const userContent = JSON.stringify(events).slice(0, 60000);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '[]';
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  const slice = jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : '[]';
  try {
    return JSON.parse(slice);
  } catch {
    throw new Error('LLM no devolvió JSON parseable');
  }
}

export async function distill(events, opts) {
  if (!events.length) return [];
  if (opts.dryRun || !opts.apiKey) return naiveDistill(events);
  return llmDistill(events, opts);
}
