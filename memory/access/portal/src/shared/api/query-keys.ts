/** Llaves de cache de TanStack Query, en un solo sitio para que invalidar sea predecible. */
export const queryKeys = {
  currentSession: ['current-session'] as const,
  users: ['users'] as const,
  /** Prefijo de todas las listas de tokens: invalidarlo refresca las dos. */
  tokens: ['tokens'] as const,
  myTokens: ['tokens', 'mine'] as const,
  allTokens: ['tokens', 'all'] as const,
}
