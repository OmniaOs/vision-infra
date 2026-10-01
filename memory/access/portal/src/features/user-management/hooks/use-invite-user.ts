import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { inviteUserRequest } from '../api/invite-user-request'

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: inviteUserRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}
