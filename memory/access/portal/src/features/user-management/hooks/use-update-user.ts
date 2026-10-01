import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { updateUserRequest } from '../api/update-user-request'

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateUserRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}
