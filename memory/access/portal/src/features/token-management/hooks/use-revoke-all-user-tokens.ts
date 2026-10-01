import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { revokeAllUserTokensRequest } from '../api/revoke-all-user-tokens-request'

export function useRevokeAllUserTokens() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: revokeAllUserTokensRequest,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.tokens }), queryClient.invalidateQueries({ queryKey: queryKeys.users })]),
  })
}
