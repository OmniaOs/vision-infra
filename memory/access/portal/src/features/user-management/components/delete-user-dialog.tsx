import { Trash2 } from 'lucide-react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { toast } from '@/shared/toast/toast'
import type { UserRecord } from '@/shared/types/user-record'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useDeleteUser } from '../hooks/use-delete-user'

interface DeleteUserDialogProps {
  user: UserRecord | null
  onClose: () => void
}

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
  const { mutate, isPending, isError, error } = useDeleteUser()
  const confirm = () => {
    if (!user) return
    mutate(user.id, {
      onSuccess: () => {
        toast.success('Persona dada de baja', `${user.id} ya no puede entrar.`)
        onClose()
      },
    })
  }
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Dar de baja a {user?.id}?</DialogTitle>
          <DialogDescription>Su token y sus sesiones dejan de funcionar al instante. Sus memorias y notas se conservan.</DialogDescription>
        </DialogHeader>
        {isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeApiError(error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <AnimatedButton variant="destructive" onClick={confirm} isLoading={isPending}>
            <Trash2 /> Dar de baja
          </AnimatedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
