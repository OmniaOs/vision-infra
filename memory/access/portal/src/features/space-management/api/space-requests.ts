import { httpDelete, httpGet, httpRequest } from '@/shared/api/http-client'
import type { AccessSettings, AliasKind, NamespaceRow, SpaceCatalogEntry } from '../types/space-types'

export async function listSpaceCatalogRequest(): Promise<SpaceCatalogEntry[]> {
  const { spaces } = await httpGet<{ spaces: SpaceCatalogEntry[] }>('/api/admin/spaces')
  return spaces
}

export async function listNamespacesRequest(): Promise<NamespaceRow[]> {
  const { namespaces } = await httpGet<{ namespaces: NamespaceRow[] }>('/api/admin/namespaces')
  return namespaces
}

export async function listProjectsRequest(): Promise<NamespaceRow[]> {
  const { projects } = await httpGet<{ projects: NamespaceRow[] }>('/api/admin/projects')
  return projects
}

export interface AssignNamespacePayload {
  kind: AliasKind
  namespace: string
  space: string
}

export function assignNamespaceRequest(payload: AssignNamespacePayload) {
  return httpRequest<{ ok: true; sesiones_cerradas: number }>('PUT', '/api/admin/aliases', payload)
}

export function removeAliasRequest({ kind, namespace }: { kind: AliasKind; namespace: string }) {
  return httpDelete<{ ok: true }>(`/api/admin/aliases/${encodeURIComponent(namespace)}?kind=${kind}`)
}

export function getAccessSettingsRequest() {
  return httpGet<AccessSettings>('/api/admin/settings')
}

export function setEnforceRequest(enforce: boolean) {
  return httpRequest<{ ok: true; enforce: boolean }>('PUT', '/api/admin/settings', { enforce })
}
