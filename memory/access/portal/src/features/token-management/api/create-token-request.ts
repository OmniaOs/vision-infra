import { httpPost } from '@/shared/api/http-client'
import type { IssuedCredentials, McpCommands } from '@/shared/types/issued-credentials'
import type { TokenRecord } from '@/shared/types/token-record'
import type { TokenScope } from '../types/token-scope'

export interface CreateTokenPayload {
  scope: TokenScope
  userId: string
  label: string
}

interface CreateTokenResponse {
  token: string
  commands: McpCommands
  record: TokenRecord
}

export async function createTokenRequest({ scope, userId, label }: CreateTokenPayload): Promise<IssuedCredentials> {
  const path = scope === 'mine' ? '/api/me/tokens' : `/api/admin/users/${encodeURIComponent(userId)}/tokens`
  const response = await httpPost<CreateTokenResponse>(path, { label })
  return { userId, mcpToken: response.token, commands: response.commands }
}
