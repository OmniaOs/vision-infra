import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentSession } from '../hooks/use-current-session'

/** Solo administradores. El servidor vuelve a comprobarlo en cada llamada; esto solo evita pantallas vacias. */
export function RequireAdminRoute() {
  const { data: session } = useCurrentSession()
  if (session?.role !== 'admin') return <Navigate to="/account" replace />
  return <Outlet />
}
