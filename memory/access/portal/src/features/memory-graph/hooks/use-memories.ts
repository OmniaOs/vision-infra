import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listMemoriesRequest } from '../api/list-memories-request'

export function useMemories(space: string | undefined) {
  return useQuery({
    queryKey: queryKeys.memories(space ?? ''),
    queryFn: () => listMemoriesRequest(space!),
    enabled: Boolean(space),
    staleTime: 30_000,
  })
}
