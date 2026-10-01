import { httpDelete } from '@/shared/api/http-client'

export function deleteUserRequest(id: string) {
  return httpDelete<{ ok: true; sesiones_cerradas: number }>(`/api/admin/users/${encodeURIComponent(id)}`)
}
