import { Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { IssuedCredentialsPanel } from '@/shared/components/issued-credentials-panel'
import type { IssuedCredentials } from '@/shared/types/issued-credentials'
import type { UserRecord } from '@/shared/types/user-record'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useInviteUser } from '../hooks/use-invite-user'

interface InviteUserDialogProps {
  user: UserRecord | null
  onClose: () => void
}

/** Pide confirmacion, crea el enlace de un solo uso y lo muestra una unica vez. */
export function InviteUserDialog({ user, onClose }: InviteUserDialogProps) {
  const { mutate, isPending, isError, error, reset } = useInviteUser()
  const [issued, setIssued] = useState<IssuedCredentials>()

  useEffect(() => {
    setIssued(undefined)
    reset()
  }, [user, reset])

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitación · {user?.id}</DialogTitle>
          <DialogDescription>
            {issued
              ? 'Listo. Envíale el enlace.'
              : 'Se crea un enlace de un solo uso para que elija su contraseña del portal. Si ya tenía una, se sustituye y se cierran sus sesiones.'}
          </DialogDescription>
        </DialogHeader>
        {issued ? <IssuedCredentialsPanel credentials={issued} /> : null}
        {isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeApiError(error)}
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
              <AnimatedButton onClick={() => user && mutate(user.id, { onSuccess: setIssued })} isLoading={isPending}>
                <Link2 /> Crear enlace
              </AnimatedButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
