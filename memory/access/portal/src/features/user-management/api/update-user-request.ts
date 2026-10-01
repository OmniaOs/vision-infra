import { httpPatch } from '@/shared/api/http-client'
import type { UserRole } from '@/shared/types/user-role'

export interface UpdateUserPayload {
  id: string
  role: UserRole
  spaces: string[]
}

export function updateUserRequest({ id, ...changes }: UpdateUserPayload) {
  return httpPatch<{ sesiones_cerradas: number }>(`/api/admin/users/${encodeURIComponent(id)}`, changes)
}
