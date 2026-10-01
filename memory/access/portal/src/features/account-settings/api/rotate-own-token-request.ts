import { httpPost } from '@/shared/api/http-client'
import type { IssuedCredentials, McpCommands } from '@/features/user-management/types/issued-credentials'

interface RotateOwnTokenResponse {
  token: string
  commands: McpCommands
}

export async function rotateOwnTokenRequest(userId: string): Promise<IssuedCredentials> {
  const response = await httpPost<RotateOwnTokenResponse>('/api/me/rotate-token')
  return { userId, mcpToken: response.token, commands: response.commands }
}
