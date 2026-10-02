import { httpPost } from '@/shared/api/http-client'

export interface DeleteMemoriesPayload {
  space: string
  ids: string[]
}

export function deleteMemoriesRequest(payload: DeleteMemoriesPayload) {
  return httpPost<{ removed: Array<{ id: string; content: string }>; missing: number }>('/api/admin/memories/delete', payload)
}
