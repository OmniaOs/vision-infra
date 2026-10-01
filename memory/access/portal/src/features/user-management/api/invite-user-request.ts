import { httpPost } from '@/shared/api/http-client'
import type { IssuedCredentials, PortalInvitation } from '@/shared/types/issued-credentials'

export async function inviteUserRequest(id: string): Promise<IssuedCredentials> {
  const response = await httpPost<{ id: string; invite: PortalInvitation }>(`/api/admin/users/${encodeURIComponent(id)}/invite`)
  return { userId: response.id, invitation: response.invite }
}
