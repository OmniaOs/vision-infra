/** Llaves de cache de TanStack Query, en un solo sitio para que invalidar sea predecible. */
export const queryKeys = {
  currentSession: ['current-session'] as const,
  users: ['users'] as const,
}
