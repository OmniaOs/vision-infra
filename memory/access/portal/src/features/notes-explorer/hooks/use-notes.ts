import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listNotesRequest } from '../api/list-notes-request'

export function useNotes(project: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notes(project ?? ''),
    queryFn: () => listNotesRequest(project!),
    enabled: Boolean(project),
    staleTime: 30_000,
  })
}
