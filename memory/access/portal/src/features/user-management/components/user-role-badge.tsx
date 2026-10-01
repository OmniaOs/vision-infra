import { USER_ROLE_METADATA } from '@/shared/domain/user-role-metadata'
import type { UserRole } from '@/shared/types/user-role'
import { Badge } from '@/shared/ui/badge'

export function UserRoleBadge({ role }: { role: UserRole }) {
  const { label, icon: Icon, badgeVariant } = USER_ROLE_METADATA[role]
  return (
    <Badge variant={badgeVariant} className="gap-1.5">
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  )
}
