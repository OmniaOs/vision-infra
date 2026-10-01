import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setCsrfToken } from '@/shared/api/csrf-token-store'
import { queryKeys } from '@/shared/api/query-keys'
import { logoutRequest } from '../api/logout-request'

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      setCsrfToken(undefined)
      queryClient.clear()
      queryClient.setQueryData(queryKeys.currentSession, null)
    },
  })
}
