import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listMyTokensRequest } from '../api/list-my-tokens-request'

export function useMyTokens() {
  return useQuery({ queryKey: queryKeys.myTokens, queryFn: listMyTokensRequest, staleTime: 10_000 })
}
