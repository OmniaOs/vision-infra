import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listNoteProjectsRequest } from '../api/list-note-projects-request'

export function useNoteProjects() {
  return useQuery({ queryKey: queryKeys.noteProjects, queryFn: listNoteProjectsRequest, staleTime: 30_000 })
}
