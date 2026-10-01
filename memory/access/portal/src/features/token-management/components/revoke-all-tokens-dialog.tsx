import { ShieldOff } from 'lucide-react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { toast } from '@/shared/toast/toast'
import type { UserRecord } from '@/shared/types/user-record'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useRevokeAllUserTokens } from '../hooks/use-revoke-all-user-tokens'

interface RevokeAllTokensDialogProps {
  user: UserRecord | null
  onClose: () => void
}

/** Para incidentes: corta todos los tokens del portal de una persona de una vez. */
export function RevokeAllTokensDialog({ user, onClose }: RevokeAllTokensDialogProps) {
  const { mutate, isPending, isError, error, reset } = useRevokeAllUserTokens()
  const close = () => {
    reset()
    onClose()
  }
  const confirm = () => {
    if (!user) return
    mutate(user.id, {
      onSuccess: ({ revocados }) => {
        toast.success('Tokens revocados', `${revocados} token${revocados === 1 ? '' : 's'} de ${user.id}.`)
        close()
      },
    })
  }
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Revocar todos los tokens de {user?.id}?</DialogTitle>
          <DialogDescription>
            Se cortan sus conexiones al instante. Los tokens que vengan de Coolify no se tocan: esos se quitan allí. Sus memorias y notas se conservan.
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
          <AnimatedButton variant="destructive" onClick={confirm} isLoading={isPending}>
            <ShieldOff /> Revocar todos
          </AnimatedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
