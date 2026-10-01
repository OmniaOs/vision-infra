import { LinkIcon, TriangleAlert } from 'lucide-react'
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
      <FadeIn className="space-y-8">
        {invitationToken ? (
          <>
            <div className="space-y-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LinkIcon className="size-6" aria-hidden />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Crea tu contraseña</h1>
              <p className="text-muted-foreground">Es solo para este portal. Tú la eliges y nadie más la conoce, ni los administradores.</p>
            </div>
            <AcceptInvitationForm invitationToken={invitationToken} />
          </>
        ) : (
          <div className="space-y-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <TriangleAlert className="size-6" aria-hidden />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Invitación no válida</h1>
            <p className="text-muted-foreground">
              El enlace está incompleto o ya se usó. Pide a un administrador que te envíe uno nuevo (cada enlace sirve una sola vez y caduca a las 24 horas).
            </p>
            <Button asChild variant="outline">
              <Link to="/sign-in">Ir a entrar</Link>
            </Button>
          </div>
        )}
      </FadeIn>
    </AuthenticationLayout>
  )
}
