import { useMutation } from '@tanstack/react-query'
import { acceptInvitationRequest } from '../api/accept-invitation-request'

export function useAcceptInvitation() {
  return useMutation({ mutationFn: acceptInvitationRequest })
}
