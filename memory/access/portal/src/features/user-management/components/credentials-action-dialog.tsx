import { KeyRound, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import type { UserRecord } from '@/shared/types/user-record'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useInviteUser } from '../hooks/use-invite-user'
import { useRotateUserToken } from '../hooks/use-rotate-user-token'
import type { IssuedCredentials } from '../types/issued-credentials'
import { IssuedCredentialsPanel } from './issued-credentials-panel'

export type CredentialsAction = 'rotate' | 'invite'

interface CredentialsActionDialogProps {
  action: CredentialsAction | null
  user: UserRecord | null
  onClose: () => void
}

const COPY = {
  rotate: {
    title: 'Generar token nuevo',
    description: 'El token actual deja de funcionar y sus sesiones del MCP se cierran. Tendrá que volver a conectarse con el comando nuevo.',
    confirm: 'Generar token',
    icon: KeyRound,
  },
  invite: {
    title: 'Nueva invitación',
    description: 'Se crea un enlace de un solo uso para que elija su contraseña del portal. Si ya tenía una, se sustituye y se cierran sus sesiones.',
    confirm: 'Crear enlace',
    icon: Link2,
  },
} as const

/** Pide confirmacion, ejecuta la accion y muestra lo emitido una unica vez. */
export function CredentialsActionDialog({ action, user, onClose }: CredentialsActionDialogProps) {
  const rotate = useRotateUserToken()
  const invite = useInviteUser()
  const [issued, setIssued] = useState<IssuedCredentials>()
  const mutation = action === 'invite' ? invite : rotate
  const copy = COPY[action ?? 'rotate']
  const Icon = copy.icon

  useEffect(() => {
    setIssued(undefined)
    rotate.reset()
    invite.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, user])

  const run = () => {
    if (user) mutation.mutate(user.id, { onSuccess: setIssued })
  }

  return (
    <Dialog open={action !== null && user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {copy.title} · {user?.id}
          </DialogTitle>
          <DialogDescription>{issued ? 'Listo. Estas son las credenciales nuevas.' : copy.description}</DialogDescription>
        </DialogHeader>
        {issued ? <IssuedCredentialsPanel credentials={issued} /> : null}
        {mutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeApiError(mutation.error)}
          </p>
        ) : null}
        <DialogFooter>
          {issued ? (
            <AnimatedButton onClick={onClose}>Listo</AnimatedButton>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <AnimatedButton onClick={run} isLoading={mutation.isPending}>
                <Icon /> {copy.confirm}
              </AnimatedButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
