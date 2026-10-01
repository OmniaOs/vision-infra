import { httpPost } from '@/shared/api/http-client'
import type { IssuedCredentials, McpCommands } from '../types/issued-credentials'

interface RotateTokenResponse {
  user: { id: string }
  token: string
  commands: McpCommands
}

export async function rotateUserTokenRequest(id: string): Promise<IssuedCredentials> {
  const response = await httpPost<RotateTokenResponse>(`/api/admin/users/${encodeURIComponent(id)}/rotate`)
  return { userId: response.user.id, mcpToken: response.token, commands: response.commands }
}
