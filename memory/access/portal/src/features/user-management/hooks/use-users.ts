import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { listUsersRequest } from '../api/list-users-request'

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: listUsersRequest, staleTime: 10_000 })
}
