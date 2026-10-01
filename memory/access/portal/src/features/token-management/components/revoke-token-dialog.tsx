import { Ban } from 'lucide-react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { toast } from '@/shared/toast/toast'
import type { TokenRecord } from '@/shared/types/token-record'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useRevokeToken } from '../hooks/use-revoke-token'
import type { TokenScope } from '../types/token-scope'

interface RevokeTokenDialogProps {
  token: TokenRecord | null
  scope: TokenScope
  onClose: () => void
}

export function RevokeTokenDialog({ token, scope, onClose }: RevokeTokenDialogProps) {
  const { mutate, isPending, isError, error, reset } = useRevokeToken()
  const close = () => {
    reset()
    onClose()
  }
  const confirm = () => {
    if (!token) return
    mutate(
      { scope, tid: token.tid },
      {
        onSuccess: ({ sesiones_cerradas }) => {
          toast.success('Token revocado', sesiones_cerradas > 0 ? `Se cortaron ${sesiones_cerradas} conexiones abiertas.` : 'Ya no se puede usar.')
          close()
        },
      },
    )
  }
  return (
    <Dialog open={token !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Revocar «{token?.label}»?</DialogTitle>
          <DialogDescription>
            Deja de funcionar al instante y se cortan sus conexiones abiertas. {token?.userId} tendrá que usar otro token o crear uno nuevo. No se puede deshacer.
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
            <Ban /> Revocar
          </AnimatedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
