import { httpDelete } from '@/shared/api/http-client'
import type { TokenScope } from '../types/token-scope'

export interface RevokeTokenPayload {
  scope: TokenScope
  tid: string
}

export function revokeTokenRequest({ scope, tid }: RevokeTokenPayload) {
  const base = scope === 'mine' ? '/api/me/tokens' : '/api/admin/tokens'
  return httpDelete<{ ok: true; sesiones_cerradas: number }>(`${base}/${encodeURIComponent(tid)}`)
}
