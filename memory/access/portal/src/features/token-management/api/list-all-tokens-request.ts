import { httpGet } from '@/shared/api/http-client'
import type { TokenRecord } from '@/shared/types/token-record'

export async function listAllTokensRequest(): Promise<TokenRecord[]> {
  const { tokens } = await httpGet<{ tokens: TokenRecord[] }>('/api/admin/tokens')
  return tokens
}
