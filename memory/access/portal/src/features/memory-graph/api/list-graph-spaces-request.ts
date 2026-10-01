import { httpGet } from '@/shared/api/http-client'

export async function listGraphSpacesRequest(): Promise<string[]> {
  const { spaces } = await httpGet<{ spaces: string[] }>('/api/graph/spaces')
  return spaces
}
