import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { createTokenRequest } from '../api/create-token-request'

export function useCreateToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTokenRequest,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.tokens }), queryClient.invalidateQueries({ queryKey: queryKeys.users })]),
  })
}
