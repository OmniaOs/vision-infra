import { httpPost } from '@/shared/api/http-client'

export function adoptUserRequest(id: string) {
  return httpPost<{ ok: true; aviso: string }>(`/api/admin/users/${encodeURIComponent(id)}/adopt`)
}
