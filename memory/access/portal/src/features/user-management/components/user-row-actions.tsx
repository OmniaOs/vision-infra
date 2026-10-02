import { ArrowRightToLine, KeyRound, Link2, MoreHorizontal, Pencil, ShieldOff, Trash2 } from 'lucide-react'
import type { UserRecord } from '@/shared/types/user-record'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

export type UserAction = 'edit' | 'tokens' | 'invite' | 'adopt' | 'revoke-tokens' | 'delete'

interface UserRowActionsProps {
  user: UserRecord
  isSelf: boolean
  onAction: (action: UserAction, user: UserRecord) => void
}

/** Menu de acciones de una fila. Las personas de Coolify solo cambian de rol tras migrarlas al portal. */
export function UserRowActions({ user, isSelf, onAction }: UserRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Acciones para ${user.id}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{user.id}</DropdownMenuLabel>
        {user.origin !== 'admins' ? (
          <DropdownMenuItem onClick={() => onAction('edit', user)}>
            <Pencil /> Cambiar rol y espacios
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => onAction('tokens', user)}>
          <KeyRound /> Ver sus tokens
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('invite', user)}>
          <Link2 /> {user.portal ? 'Restablecer contraseña' : 'Nueva invitación'}
        </DropdownMenuItem>
        {user.origin === 'env' ? (
          <DropdownMenuItem onClick={() => onAction('adopt', user)}>
            <ArrowRightToLine /> Migrar al portal
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction('revoke-tokens', user)}>
          <ShieldOff /> Revocar todos sus tokens
        </DropdownMenuItem>
        {user.editable && !isSelf ? (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction('delete', user)}>
            <Trash2 /> Dar de baja
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
