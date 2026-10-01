import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listUsersRequest } from '../api/list-users-request'

/** `enabled` permite pedirla solo cuando hace falta (por ejemplo al abrir un dialogo). */
export function useUsers(enabled = true) {
  return useQuery({ queryKey: queryKeys.users, queryFn: listUsersRequest, staleTime: 10_000, enabled })
}
