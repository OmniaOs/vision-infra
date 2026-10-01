import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { createUserRequest } from '../api/create-user-request'

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createUserRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}
