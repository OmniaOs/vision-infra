/** Llaves de cache de TanStack Query, en un solo sitio para que invalidar sea predecible. */
export const queryKeys = {
  currentSession: ['current-session'] as const,
  users: ['users'] as const,
  /** Prefijo de todas las listas de tokens: invalidarlo refresca las dos. */
  tokens: ['tokens'] as const,
  myTokens: ['tokens', 'mine'] as const,
  allTokens: ['tokens', 'all'] as const,
  noteProjects: ['notes', 'projects'] as const,
  notes: (project: string) => ['notes', 'tree', project] as const,
  note: (project: string, permalink: string) => ['notes', 'note', project, permalink] as const,
  graphSpaces: ['graph', 'spaces'] as const,
  spaceCatalog: ['spaces', 'catalog'] as const,
  namespaces: ['spaces', 'namespaces'] as const,
  memories: (space: string) => ['graph', 'memories', space] as const,
}
