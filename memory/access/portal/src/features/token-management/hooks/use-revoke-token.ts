import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { revokeTokenRequest } from '../api/revoke-token-request'

export function useRevokeToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: revokeTokenRequest,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.tokens }), queryClient.invalidateQueries({ queryKey: queryKeys.users })]),
  })
}
