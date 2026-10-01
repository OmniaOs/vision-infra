import { httpPost } from '@/shared/api/http-client'

export function revokeAllUserTokensRequest(userId: string) {
  return httpPost<{ ok: true; revocados: number; sesiones_cerradas: number }>(`/api/admin/users/${encodeURIComponent(userId)}/tokens/revoke-all`)
}
