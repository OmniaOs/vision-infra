import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listAllTokensRequest } from '../api/list-all-tokens-request'

/** Solo administradores: `enabled` evita pedirlo (y recibir un 403) a quien no lo es. */
export function useAllTokens(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.allTokens, queryFn: listAllTokensRequest, staleTime: 10_000, enabled })
}
