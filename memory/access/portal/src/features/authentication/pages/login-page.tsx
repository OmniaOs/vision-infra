import { Navigate, useLocation } from 'react-router-dom'
import { FadeIn } from '@/shared/motion/fade-in'
import { AuthenticationLayout } from '../components/authentication-layout'
import { LoginForm } from '../components/login-form'
import { useCurrentSession } from '../hooks/use-current-session'
import { readInvitationFromHash } from '../lib/read-invitation-from-hash'

export function LoginPage() {
  const location = useLocation()
  const { data: session } = useCurrentSession()
  const invitedAs = (location.state as { invitedAs?: string } | null)?.invitedAs

  // Un enlace de invitacion abierto en la raiz o en esta pagina lleva a crear la contrasena.
  if (readInvitationFromHash(location.hash)) return <Navigate to={{ pathname: '/accept-invitation', hash: location.hash }} replace />
  if (session) return <Navigate to="/" replace />

  return (
    <AuthenticationLayout>
      <FadeIn className="space-y-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{invitedAs ? 'Listo, ya puedes entrar' : 'Entrar'}</h1>
        <LoginForm initialId={invitedAs} />
      </FadeIn>
    </AuthenticationLayout>
  )
}
