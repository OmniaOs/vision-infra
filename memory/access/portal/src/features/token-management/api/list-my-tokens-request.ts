import { httpGet } from '@/shared/api/http-client'
import type { TokenRecord } from '@/shared/types/token-record'

export async function listMyTokensRequest(): Promise<TokenRecord[]> {
  const { tokens } = await httpGet<{ tokens: TokenRecord[] }>('/api/me/tokens')
  return tokens
}
