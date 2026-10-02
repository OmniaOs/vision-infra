import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FadeIn } from '@/shared/motion/fade-in'
import { Button } from '@/shared/ui/button'
import { AcceptInvitationForm } from '../components/accept-invitation-form'
import { AuthenticationLayout } from '../components/authentication-layout'
import { readInvitationFromHash } from '../lib/read-invitation-from-hash'

export function AcceptInvitationPage() {
  const location = useLocation()
  // El codigo se lee una vez y se quita de la barra de direcciones: no queda en el historial.
  const [invitationToken] = useState(() => {
    const token = readInvitationFromHash(location.hash)
    if (token) window.history.replaceState(null, '', location.pathname)
    return token
  })

  return (
    <AuthenticationLayout>
      <FadeIn className="space-y-6">
        {invitationToken ? (
          <>
            <h1 className="text-center text-2xl font-semibold tracking-tight">Crea tu contraseña</h1>
            <AcceptInvitationForm invitationToken={invitationToken} />
          </>
        ) : (
          <div className="space-y-5 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Invitación no válida</h1>
            <p className="text-sm text-muted-foreground">El enlace ya se usó o caducó. Pide uno nuevo a un administrador.</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/sign-in">Ir a entrar</Link>
            </Button>
          </div>
        )}
      </FadeIn>
    </AuthenticationLayout>
  )
}
