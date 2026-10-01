import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { readNoteRequest } from '../api/read-note-request'

export function useNote(project: string | undefined, permalink: string | undefined) {
  return useQuery({
    queryKey: queryKeys.note(project ?? '', permalink ?? ''),
    queryFn: () => readNoteRequest(project!, permalink!),
    enabled: Boolean(project && permalink),
    staleTime: 30_000,
  })
}
