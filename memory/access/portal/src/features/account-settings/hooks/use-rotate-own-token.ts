import { useMutation } from '@tanstack/react-query'
import { rotateOwnTokenRequest } from '../api/rotate-own-token-request'

export function useRotateOwnToken() {
  return useMutation({ mutationFn: rotateOwnTokenRequest })
}
