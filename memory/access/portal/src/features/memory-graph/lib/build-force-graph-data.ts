import type { ForceGraphData, ForceLink, ForceNode, MemoriesResponse, MemoryTopic } from '../types/graph-types'
import { topicColor, UNASSIGNED_COLOR, UNASSIGNED_TOPIC_ID } from './topic-colors'

const UNASSIGNED: MemoryTopic = { id: UNASSIGNED_TOPIC_ID, label: 'Sin tema', size: 0 }

/**
 * Nodos: un nucleo por tema (grande, con su nombre) y una memoria por punto. Enlaces: cada memoria a su tema, y
 * entre memorias muy parecidas (los enlaces cruzan temas: ahi se ve como se relacionan).
 */
export function buildForceGraphData(response: MemoriesResponse): ForceGraphData {
  const topics = [...response.clusters]
  const orphans = response.memories.filter((memory) => !memory.cluster || !topics.some((topic) => topic.id === memory.cluster))
  if (orphans.length > 0) topics.push({ ...UNASSIGNED, size: orphans.length })

  const colorOf = new Map(topics.map((topic, index) => [topic.id, topic.id === UNASSIGNED_TOPIC_ID ? UNASSIGNED_COLOR : topicColor(index)]))
  // Los nucleos van fijos en un anillo: el diagrama siempre queda ordenado y cabe en pantalla. Solo las memorias flotan.
  const ring = topics.length === 1 ? 0 : 150 + topics.length * 34
  const nodes: ForceNode[] = topics.map((topic, index) => ({
    id: `topic:${topic.id}`,
    kind: 'topic',
    label: topic.label,
    topicId: topic.id,
    color: colorOf.get(topic.id)!,
    radius: 9 + Math.min(11, Math.sqrt(topic.size) * 1.6),
    topic,
    fx: Math.cos((index / topics.length) * 2 * Math.PI - Math.PI / 2) * ring,
    fy: Math.sin((index / topics.length) * 2 * Math.PI - Math.PI / 2) * ring,
  }))
  const links: ForceLink[] = []
  const known = new Set<string>()

  for (const memory of response.memories) {
    const topicId = memory.cluster && colorOf.has(memory.cluster) ? memory.cluster : UNASSIGNED_TOPIC_ID
    known.add(memory.id)
    nodes.push({ id: memory.id, kind: 'memory', label: memory.content, topicId, color: colorOf.get(topicId)!, radius: 3.6, memory })
    links.push({ source: memory.id, target: `topic:${topicId}`, kind: 'membership', strength: 1 })
  }
  for (const [a, b, similarity] of response.links) {
    if (known.has(a) && known.has(b)) links.push({ source: a, target: b, kind: 'similarity', strength: similarity })
  }
  return { nodes, links }
}

/** Memorias enlazadas con `id` por similitud, de la mas parecida a la menos. */
export function relatedMemoryIds(response: MemoriesResponse, id: string, limit = 4): string[] {
  return response.links
    .filter(([a, b]) => a === id || b === id)
    .sort((x, y) => y[2] - x[2])
    .map(([a, b]) => (a === id ? b : a))
    .slice(0, limit)
}

/** Ids de memorias cuyo texto o categorias contienen la busqueda; `null` si no hay busqueda. */
export function matchMemories(response: MemoriesResponse, query: string): Set<string> | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return null
  return new Set(
    response.memories.filter((memory) => memory.content.toLowerCase().includes(needle) || memory.categories.some((category) => category.toLowerCase().includes(needle))).map((memory) => memory.id),
  )
}
