import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { deleteUserRequest } from '../api/delete-user-request'

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteUserRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}
