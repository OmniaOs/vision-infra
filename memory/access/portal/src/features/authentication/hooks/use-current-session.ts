import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/api/query-keys'
import { fetchCurrentSession } from '../api/fetch-current-session-request'

/** `data` es la sesion, `null` si no hay sesion y `undefined` mientras se comprueba. */
export function useCurrentSession() {
  return useQuery({
    queryKey: queryKeys.currentSession,
    queryFn: fetchCurrentSession,
    staleTime: 30_000,
    retry: false,
  })
}
