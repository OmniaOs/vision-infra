import { httpGet } from '@/shared/api/http-client'
import type { MemoriesResponse } from '../types/graph-types'

export function listMemoriesRequest(space: string) {
  return httpGet<MemoriesResponse>(`/api/graph?space=${encodeURIComponent(space)}`)
}
