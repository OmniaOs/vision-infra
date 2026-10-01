export interface MemoryItem {
  id: string
  content: string
  createdAt: string | null
  categories: string[]
  app: string | null
}

export interface MemoriesResponse {
  space: string
  total: number
  memories: MemoryItem[]
}

export interface GraphNode {
  id: string
  kind: 'hub' | 'memory'
  x: number
  y: number
  radius: number
  label: string
  /** Solo en los nodos de tipo `memory`. */
  memory?: MemoryItem
  /** Cuantas memorias cuelgan de este hub. */
  count?: number
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  /** Enlace a una categoria secundaria (mas tenue). */
  secondary: boolean
}

export interface MemoryGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
}
