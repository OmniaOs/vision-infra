import { useEffect, useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { toast } from '@/shared/toast/toast'
import type { UserRecord } from '@/shared/types/user-record'
import type { UserRole } from '@/shared/types/user-role'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useUpdateUser } from '../hooks/use-update-user'
import { UserPermissionsFields } from './user-permissions-fields'

interface EditUserDialogProps {
  user: UserRecord | null
  onClose: () => void
}

export function EditUserDialog({ user, onClose }: EditUserDialogProps) {
  const { mutate, reset, isPending, isError, error } = useUpdateUser()
  const [permissions, setPermissions] = useState<{ role: UserRole; spaces: string[] }>({ role: 'miembro', spaces: [] })

  useEffect(() => {
    if (user) setPermissions({ role: user.role, spaces: user.spaces })
    reset()
  }, [user, reset])

  const save = () => {
    if (!user) return
    mutate(
      { id: user.id, ...permissions },
      {
        onSuccess: ({ sesiones_cerradas }) => {
          toast.success('Cambios guardados', sesiones_cerradas > 0 ? 'Sus sesiones abiertas se cerraron para aplicar los permisos.' : undefined)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permisos de {user?.id}</DialogTitle>
          <DialogDescription>Los cambios se aplican al momento, sin reiniciar nada.</DialogDescription>
        </DialogHeader>
        <UserPermissionsFields idPrefix="edit-user" role={permissions.role} spaces={permissions.spaces} onChange={setPermissions} />
        {isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describeApiError(error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <AnimatedButton onClick={save} isLoading={isPending}>
            Guardar
          </AnimatedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
