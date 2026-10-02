export interface MemoryItem {
  id: string
  content: string
  createdAt: string | null
  categories: string[]
  app: string | null
  /** Tema (cluster) al que pertenece, o null si no se pudo calcular. */
  cluster: string | null
}

export interface MemoryTopic {
  id: string
  label: string
  size: number
}

/** Memorias parecidas entre si: [idA, idB, similitud 0-1]. */
export type MemoryLink = [string, string, number]

export interface MemoriesResponse {
  space: string
  total: number
  memories: MemoryItem[]
  clusters: MemoryTopic[]
  links: MemoryLink[]
}

export interface GraphSpace {
  /** Espacio (`int-frutal`) o namespace antiguo sin espacio (`ns:vision-infra`, solo admin). */
  id: string
  label: string
  count: number
  mapped: boolean
}

export interface ForceNode {
  id: string
  kind: 'topic' | 'memory'
  label: string
  /** Id del tema; en los nucleos es su propio id. */
  topicId: string
  color: string
  radius: number
  memory?: MemoryItem
  topic?: MemoryTopic
  x?: number
  y?: number
  /** Posicion fija (los nucleos de los temas no se mueven). */
  fx?: number
  fy?: number
}

export interface ForceLink {
  source: string
  target: string
  kind: 'membership' | 'similarity'
  strength: number
}

export interface ForceGraphData {
  nodes: ForceNode[]
  links: ForceLink[]
}
