import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { assignNamespaceRequest, listNamespacesRequest, listSpaceCatalogRequest, removeAliasRequest } from '../api/space-requests'

/** Espacios que ya existen: lo que se puede asignar a una persona o a un namespace. Solo administradores. */
export function useSpaceCatalog(enabled = true) {
  return useQuery({ queryKey: queryKeys.spaceCatalog, queryFn: listSpaceCatalogRequest, staleTime: 15_000, enabled })
}

export function useNamespaces() {
  return useQuery({ queryKey: queryKeys.namespaces, queryFn: listNamespacesRequest, staleTime: 10_000 })
}

function useRefreshSpaces() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.namespaces }),
      queryClient.invalidateQueries({ queryKey: queryKeys.spaceCatalog }),
      queryClient.invalidateQueries({ queryKey: queryKeys.graphSpaces }),
    ])
}

export function useAssignNamespace() {
  const refresh = useRefreshSpaces()
  return useMutation({ mutationFn: assignNamespaceRequest, onSuccess: refresh })
}

export function useRemoveAlias() {
  const refresh = useRefreshSpaces()
  return useMutation({ mutationFn: removeAliasRequest, onSuccess: refresh })
}
