import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { loginRequest } from '../api/login-request'

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: loginRequest,
    // La sesion se vuelve a leer del servidor: ahi viene tambien la marca CSRF.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.currentSession }),
  })
}
