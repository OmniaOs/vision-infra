import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { adoptUserRequest } from '../api/adopt-user-request'

export function useAdoptUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adoptUserRequest,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.users }), queryClient.invalidateQueries({ queryKey: queryKeys.tokens })]),
  })
}
