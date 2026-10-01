import { Navigate } from 'react-router-dom'
import { useCurrentSession } from '@/features/authentication/hooks/use-current-session'

/** La entrada del portal: administradores a Personas, el resto a su cuenta. */
export function HomeRedirect() {
  const { data: session } = useCurrentSession()
  return <Navigate to={session?.role === 'admin' ? '/people' : '/account'} replace />
}
