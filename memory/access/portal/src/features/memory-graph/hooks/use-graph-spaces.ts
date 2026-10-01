import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listGraphSpacesRequest } from '../api/list-graph-spaces-request'

export function useGraphSpaces() {
  return useQuery({ queryKey: queryKeys.graphSpaces, queryFn: listGraphSpacesRequest, staleTime: 30_000 })
}
