import { httpGet } from '@/shared/api/http-client'
import type { NoteSummary } from '../types/note-types'

export async function listNotesRequest(project: string): Promise<NoteSummary[]> {
  const { notes } = await httpGet<{ notes: NoteSummary[] }>(`/api/notes/tree?project=${encodeURIComponent(project)}`)
  return notes
}
