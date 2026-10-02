import { httpGet } from '@/shared/api/http-client'
import type { GraphSpace } from '../types/graph-types'

export async function listGraphSpacesRequest(): Promise<GraphSpace[]> {
  const { spaces } = await httpGet<{ spaces: GraphSpace[] }>('/api/graph/spaces')
  return spaces
}
