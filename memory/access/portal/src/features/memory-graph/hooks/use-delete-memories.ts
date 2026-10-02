import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { deleteMemoriesRequest } from '../api/delete-memories-request'

/** Solo administradores. Al borrar se refrescan el grafo, los conteos y los selectores de espacio. */
export function useDeleteMemories() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteMemoriesRequest,
    onSuccess: () =>
      Promise.all(
        [['graph'], queryKeys.namespaces, queryKeys.spaceCatalog].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  })
}
