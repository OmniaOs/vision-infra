import { ApiError } from '@/shared/api/api-error'
import { setCsrfToken } from '@/shared/api/csrf-token-store'
import { httpGet } from '@/shared/api/http-client'
import type { CurrentSession } from '@/shared/types/current-session'

/** Persona de la sesion actual, o null si no hay sesion abierta (no es un error). */
export async function fetchCurrentSession(): Promise<CurrentSession | null> {
  try {
    const session = await httpGet<CurrentSession>('/api/me')
    setCsrfToken(session.csrf)
    return session
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setCsrfToken(undefined)
      return null
    }
    throw error
  }
}
