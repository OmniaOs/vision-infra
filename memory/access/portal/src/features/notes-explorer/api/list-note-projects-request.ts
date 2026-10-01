import { httpGet } from '@/shared/api/http-client'
import type { NoteProject } from '../types/note-types'

export async function listNoteProjectsRequest(): Promise<NoteProject[]> {
  const { projects } = await httpGet<{ projects: NoteProject[] }>('/api/notes/projects')
  return projects
}
