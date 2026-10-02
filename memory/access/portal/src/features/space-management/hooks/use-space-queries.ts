import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import {
  assignNamespaceRequest,
  getAccessSettingsRequest,
  listNamespacesRequest,
  listProjectsRequest,
  listSpaceCatalogRequest,
  removeAliasRequest,
  setEnforceRequest,
} from '../api/space-requests'

/** Espacios que ya existen: lo que se puede asignar a una persona o a un namespace. Solo administradores. */
export function useSpaceCatalog(enabled = true) {
  return useQuery({ queryKey: queryKeys.spaceCatalog, queryFn: listSpaceCatalogRequest, staleTime: 15_000, enabled })
}

export function useNamespaces() {
  return useQuery({ queryKey: queryKeys.namespaces, queryFn: listNamespacesRequest, staleTime: 10_000 })
}

export function useKbProjects() {
  return useQuery({ queryKey: queryKeys.kbProjects, queryFn: listProjectsRequest, staleTime: 10_000 })
}

export function useAccessSettings() {
  return useQuery({ queryKey: queryKeys.accessSettings, queryFn: getAccessSettingsRequest, staleTime: 5_000 })
}

function useRefreshSpaces() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [queryKeys.namespaces, queryKeys.kbProjects, queryKeys.spaceCatalog, queryKeys.graphSpaces, queryKeys.noteProjects].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
}

export function useAssignNamespace() {
  const refresh = useRefreshSpaces()
  return useMutation({ mutationFn: assignNamespaceRequest, onSuccess: refresh })
}

export function useRemoveAlias() {
  const refresh = useRefreshSpaces()
  return useMutation({ mutationFn: removeAliasRequest, onSuccess: refresh })
}

export function useSetEnforce() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: setEnforceRequest, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accessSettings }) })
}
