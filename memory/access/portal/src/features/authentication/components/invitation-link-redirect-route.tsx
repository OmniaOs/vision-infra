import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { readInvitationFromHash } from '../lib/read-invitation-from-hash'

/** Los enlaces de invitacion llegan a la raiz (`/#invitacion=...`): se mandan a su pantalla conservando el codigo. */
export function InvitationLinkRedirectRoute() {
  const { pathname, hash } = useLocation()
  if (pathname === '/' && readInvitationFromHash(hash)) {
    return <Navigate to={{ pathname: '/accept-invitation', hash }} replace />
  }
  return <Outlet />
}
