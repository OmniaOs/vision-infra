import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLogout } from '@/features/authentication/hooks/use-logout'
import { USER_ROLE_METADATA } from '@/shared/domain/user-role-metadata'
import { getInitials } from '@/shared/lib/get-initials'
import type { CurrentSession } from '@/shared/types/current-session'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

export function ShellUserMenu({ session }: { session: CurrentSession }) {
  const navigate = useNavigate()
  const logout = useLogout()
  const role = USER_ROLE_METADATA[session.role]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl border bg-card py-1.5 pl-1.5 pr-2.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/15 text-primary">{getInitials(session.id)}</AvatarFallback>
        </Avatar>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-medium">{session.id}</span>
          <span className="block text-xs text-muted-foreground">{role.label}</span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sesión de {session.id}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate('/account')}>
          <UserRound /> Mi cuenta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => logout.mutate(undefined, { onSettled: () => navigate('/sign-in', { replace: true }) })}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
