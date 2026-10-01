import { httpPost } from '@/shared/api/http-client'

export interface AcceptInvitationPayload {
  token: string
  password: string
}

export function acceptInvitationRequest(payload: AcceptInvitationPayload) {
  return httpPost<{ ok: true; id: string }>('/api/auth/accept-invite', payload)
}
