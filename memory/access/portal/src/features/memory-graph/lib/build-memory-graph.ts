import type { GraphEdge, GraphNode, MemoryGraph, MemoryItem } from '../types/graph-types'

export const GRAPH_WIDTH = 1000
export const GRAPH_HEIGHT = 640
export const UNCATEGORIZED = 'sin categoría'

const GOLDEN_ANGLE = 2.399963229728653
const hubId = (category: string) => `hub:${category}`

/**
 * Cada categoria es un nucleo; sus memorias se reparten en espiral a su alrededor (siempre en el mismo sitio:
 * sin simulacion, asi el grafo no "baila" al recargar). Una memoria con varias categorias cuelga de la primera
 * y se enlaza con tenuidad a las demas.
 */
export function buildMemoryGraph(memories: MemoryItem[]): MemoryGraph {
  const groups = new Map<string, MemoryItem[]>()
  for (const memory of memories) {
    const primary = memory.categories[0] ?? UNCATEGORIZED
    groups.set(primary, [...(groups.get(primary) ?? []), memory])
  }
  const categories = [...groups.keys()].sort((a, b) => (groups.get(b)!.length - groups.get(a)!.length) || a.localeCompare(b, 'es'))

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const ring = categories.length === 1 ? 0 : Math.max(210, categories.length * 62)

  categories.forEach((category, index) => {
    const angle = (index / categories.length) * Math.PI * 2 - Math.PI / 2
    const cx = Math.cos(angle) * ring
    const cy = Math.sin(angle) * ring
    const items = groups.get(category)!
    nodes.push({ id: hubId(category), kind: 'hub', x: cx, y: cy, radius: 16 + Math.min(14, Math.sqrt(items.length) * 2), label: category, count: items.length })
    items.forEach((memory, i) => {
      const distance = 38 + 15 * Math.sqrt(i + 1)
      const theta = i * GOLDEN_ANGLE + index
      nodes.push({ id: memory.id, kind: 'memory', x: cx + Math.cos(theta) * distance, y: cy + Math.sin(theta) * distance, radius: 5, label: memory.content.slice(0, 80), memory })
      edges.push({ id: `${memory.id}>${hubId(category)}`, from: memory.id, to: hubId(category), secondary: false })
      for (const extra of memory.categories.slice(1)) {
        if (groups.has(extra)) edges.push({ id: `${memory.id}>${hubId(extra)}`, from: memory.id, to: hubId(extra), secondary: true })
      }
    })
  })

  return fit(nodes, edges)
}

/** Escala y centra todo dentro del lienzo de 1000 x 640. */
function fit(nodes: GraphNode[], edges: GraphEdge[]): MemoryGraph {
  if (nodes.length === 0) return { nodes, edges, width: GRAPH_WIDTH, height: GRAPH_HEIGHT }
  const margin = 60
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scale = Math.min(1.4, (GRAPH_WIDTH - margin * 2) / Math.max(1, maxX - minX), (GRAPH_HEIGHT - margin * 2) / Math.max(1, maxY - minY))
  const offsetX = GRAPH_WIDTH / 2 - ((minX + maxX) / 2) * scale
  const offsetY = GRAPH_HEIGHT / 2 - ((minY + maxY) / 2) * scale
  return {
    nodes: nodes.map((n) => ({ ...n, x: n.x * scale + offsetX, y: n.y * scale + offsetY, radius: n.kind === 'hub' ? n.radius * Math.max(0.7, scale) : Math.max(3, n.radius * scale) })),
    edges,
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
  }
}

/** Ids de memorias cuyo texto o categorias contienen la busqueda; `null` si no hay busqueda. */
export function matchMemories(memories: MemoryItem[], query: string): Set<string> | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return null
  return new Set(memories.filter((m) => m.content.toLowerCase().includes(needle) || m.categories.some((c) => c.toLowerCase().includes(needle))).map((m) => m.id))
}
