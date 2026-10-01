import { KeyRound, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { UserRecord } from '@/shared/types/user-record'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

export type UserAction = 'edit' | 'rotate' | 'invite' | 'delete'

interface UserRowActionsProps {
  user: UserRecord
  isSelf: boolean
  onAction: (action: UserAction, user: UserRecord) => void
}

/** Menu de acciones de una fila. Las personas gestionadas desde Coolify no se pueden tocar aqui. */
export function UserRowActions({ user, isSelf, onAction }: UserRowActionsProps) {
  if (!user.editable) return <span className="text-xs text-muted-foreground">Coolify</span>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Acciones para ${user.id}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{user.id}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAction('edit', user)}>
          <Pencil /> Cambiar rol y espacios
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('invite', user)}>
          <Link2 /> {user.portal ? 'Restablecer contraseña' : 'Nueva invitación'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('rotate', user)}>
          <KeyRound /> Generar token nuevo
        </DropdownMenuItem>
        {isSelf ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction('delete', user)}>
              <Trash2 /> Dar de baja
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
