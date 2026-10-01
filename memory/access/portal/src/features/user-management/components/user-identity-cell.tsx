import { getInitials } from '@/shared/lib/get-initials'
import type { UserRecord } from '@/shared/types/user-record'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'

const ORIGIN_HINT: Record<UserRecord['origin'], string> = {
  file: 'Gestionada desde el portal',
  env: 'Gestionada en Coolify',
  admins: 'Acceso de emergencia (Coolify)',
}

export function UserIdentityCell({ user }: { user: UserRecord }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback className="bg-primary/12 text-primary">{getInitials(user.id)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <p className="truncate font-medium">{user.id}</p>
        <p className="truncate text-xs text-muted-foreground">{ORIGIN_HINT[user.origin]}</p>
      </div>
    </div>
  )
}
