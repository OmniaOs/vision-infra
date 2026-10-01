import { getInitials } from '@/shared/lib/get-initials'
import type { CurrentSession } from '@/shared/types/current-session'
import { UserRoleBadge } from '@/features/user-management/components/user-role-badge'
import { UserSpacesList } from '@/features/user-management/components/user-spaces-list'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Card, CardContent } from '@/shared/ui/card'

/** Quien eres y a que tienes acceso. */
export function SessionSummaryCard({ session }: { session: CurrentSession }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary/12 text-lg text-primary">{getInitials(session.id)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">{session.id}</h2>
            <UserRoleBadge role={session.role} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Espacios</p>
            <UserSpacesList role={session.role} spaces={session.spaces} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
