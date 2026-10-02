import { ApiError } from './api-error'
import { getCsrfToken } from './csrf-token-store'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ErrorBody {
  error?: string
  detail?: string
}

/** Peticion JSON al mismo origen. Las escrituras llevan la marca CSRF de la sesion. */
export async function httpRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (method !== 'GET') {
    const csrf = getCsrfToken()
    if (csrf) headers['x-csrf'] = csrf
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const failure = (data ?? {}) as ErrorBody
    throw new ApiError(response.status, failure.error ?? 'desconocido', failure.detail)
  }
  return data as T
}

export const httpGet = <T>(path: string) => httpRequest<T>('GET', path)
export const httpPost = <T>(path: string, body?: unknown) => httpRequest<T>('POST', path, body ?? {})
export const httpPatch = <T>(path: string, body: unknown) => httpRequest<T>('PATCH', path, body)
export const httpDelete = <T>(path: string) => httpRequest<T>('DELETE', path)
