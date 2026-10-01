import { ArrowRightToLine } from 'lucide-react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { toast } from '@/shared/toast/toast'
import type { UserRecord } from '@/shared/types/user-record'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useAdoptUser } from '../hooks/use-adopt-user'

interface AdoptUserDialogProps {
  user: UserRecord | null
  onClose: () => void
}

/** Pasa a una persona de ACCESS_DEVS (Coolify) al portal, con el mismo token. */
export function AdoptUserDialog({ user, onClose }: AdoptUserDialogProps) {
  const { mutate, isPending, isError, error, reset } = useAdoptUser()
  const close = () => {
    reset()
    onClose()
  }
  const confirm = () => {
    if (!user) return
    mutate(user.id, {
      onSuccess: () => {
        toast.success('Migrada al portal', `Ya puedes quitar la línea de ${user.id} en ACCESS_DEVS (Coolify).`)
        close()
      },
    })
  }
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Migrar a {user?.id} al portal</DialogTitle>
          <DialogDescription>
            Conserva el mismo token, rol y espacios, y desde ahora se gestiona aquí: cambiar permisos, crear y revocar tokens, darla de baja. Después puedes borrar su línea de ACCESS_DEVS en Coolify.
          </DialogDescription>
        </DialogHeader>
        {isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeApiError(error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <AnimatedButton onClick={confirm} isLoading={isPending}>
            <ArrowRightToLine /> Migrar
          </AnimatedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
