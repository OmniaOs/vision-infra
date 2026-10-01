import { httpPost } from '@/shared/api/http-client'

export interface ChangePasswordPayload {
  current: string
  next: string
}

export function changePasswordRequest(payload: ChangePasswordPayload) {
  return httpPost<{ ok: true; sesiones_cerradas: number }>('/api/auth/password', payload)
}
