import { httpPost } from '@/shared/api/http-client'
import type { UserRole } from '@/shared/types/user-role'
import type { IssuedCredentials, McpCommands, PortalInvitation } from '@/shared/types/issued-credentials'

export interface CreateUserPayload {
  id: string
  role: UserRole
  spaces: string[]
}

interface CreateUserResponse {
  user: { id: string }
  token: string
  commands: McpCommands
  invite: PortalInvitation
}

export async function createUserRequest(payload: CreateUserPayload): Promise<IssuedCredentials> {
  const response = await httpPost<CreateUserResponse>('/api/admin/users', payload)
  return { userId: response.user.id, mcpToken: response.token, commands: response.commands, invitation: response.invite }
}
