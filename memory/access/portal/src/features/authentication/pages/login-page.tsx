import { KeyRound } from 'lucide-react'
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
      <FadeIn className="space-y-8">
        <div className="space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="size-6" aria-hidden />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Bienvenido de nuevo</h1>
          <p className="text-muted-foreground">
            {invitedAs ? `Todo listo, ${invitedAs}. Entra con tu usuario y tu nueva contraseña.` : 'Entra con tu usuario y contraseña del portal.'}
          </p>
        </div>
        <LoginForm initialId={invitedAs} />
        <p className="text-center text-xs text-muted-foreground">
          La contraseña del portal es distinta del token del MCP. ¿Primera vez? Abre el enlace de invitación que te enviaron.
        </p>
      </FadeIn>
    </AuthenticationLayout>
  )
}
