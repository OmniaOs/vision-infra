import { httpPost } from '@/shared/api/http-client'

export function logoutRequest() {
  return httpPost<{ ok: true }>('/api/auth/logout')
}
