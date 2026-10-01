import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { rotateUserTokenRequest } from '../api/rotate-user-token-request'

export function useRotateUserToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rotateUserTokenRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}
