import { Navigate, Outlet } from 'react-router-dom'
import { LoadingScreen } from '@/shared/components/loading-screen'
import { useCurrentSession } from '../hooks/use-current-session'

/** Deja pasar solo a quien tiene sesion; al resto lo manda a entrar. */
export function RequireSessionRoute() {
  const { data: session, isPending } = useCurrentSession()
  if (isPending) return <LoadingScreen />
  if (!session) return <Navigate to="/sign-in" replace />
  return <Outlet />
}
