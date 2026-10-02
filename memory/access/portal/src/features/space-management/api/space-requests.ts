import { httpDelete, httpGet, httpRequest } from '@/shared/api/http-client'
import type { NamespaceRow, SpaceCatalogEntry } from '../types/space-types'

export async function listSpaceCatalogRequest(): Promise<SpaceCatalogEntry[]> {
  const { spaces } = await httpGet<{ spaces: SpaceCatalogEntry[] }>('/api/admin/spaces')
  return spaces
}

export async function listNamespacesRequest(): Promise<NamespaceRow[]> {
  const { namespaces } = await httpGet<{ namespaces: NamespaceRow[] }>('/api/admin/namespaces')
  return namespaces
}

export interface AssignNamespacePayload {
  namespace: string
  space: string
}

export function assignNamespaceRequest(payload: AssignNamespacePayload) {
  return httpRequest<{ ok: true; sesiones_cerradas: number }>('PUT', '/api/admin/aliases', payload)
}

export function removeAliasRequest(namespace: string) {
  return httpDelete<{ ok: true }>(`/api/admin/aliases/${encodeURIComponent(namespace)}`)
}
