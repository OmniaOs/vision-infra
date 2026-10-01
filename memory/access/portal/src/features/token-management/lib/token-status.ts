import type { TokenRecord } from '@/shared/types/token-record'

export type TokenStatus = 'active' | 'revoked' | 'coolify'

/** Revocado gana siempre; los de Coolify estan activos pero no se pueden revocar desde el portal. */
export function getTokenStatus(token: Pick<TokenRecord, 'revokedAt' | 'managed'>): TokenStatus {
  if (token.revokedAt) return 'revoked'
  return token.managed ? 'active' : 'coolify'
}

export const TOKEN_STATUS_LABEL: Record<TokenStatus, string> = {
  active: 'Activo',
  revoked: 'Revocado',
  coolify: 'Coolify',
}
