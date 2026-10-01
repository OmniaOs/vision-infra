import { useMutation } from '@tanstack/react-query'
import { changePasswordRequest } from '../api/change-password-request'

export function useChangePassword() {
  return useMutation({ mutationFn: changePasswordRequest })
}
