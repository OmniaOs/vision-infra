import { KeyRound } from 'lucide-react'
import { formatRelativeTime } from '@/shared/lib/format-relative-time'
import type { UserRecord } from '@/shared/types/user-record'

/** Cuantos tokens activos tiene y cuando se uso alguno por ultima vez. */
export function UserTokensSummary({ user }: { user: UserRecord }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="font-medium">{user.tokenCount}</span>
      <span className="text-muted-foreground">· {user.lastUsedAt ? formatRelativeTime(user.lastUsedAt) : 'sin uso'}</span>
    </div>
  )
}
