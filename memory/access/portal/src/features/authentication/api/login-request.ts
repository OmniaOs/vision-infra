import { httpPost } from '@/shared/api/http-client'

export interface LoginCredentials {
  id: string
  password: string
}

export function loginRequest(credentials: LoginCredentials) {
  return httpPost<{ id: string }>('/api/auth/login', credentials)
}
