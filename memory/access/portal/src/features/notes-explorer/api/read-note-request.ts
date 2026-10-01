import { httpGet } from '@/shared/api/http-client'
import type { NoteDocument } from '../types/note-types'

export function readNoteRequest(project: string, permalink: string) {
  return httpGet<NoteDocument>(`/api/notes/note?project=${encodeURIComponent(project)}&id=${encodeURIComponent(permalink)}`)
}
