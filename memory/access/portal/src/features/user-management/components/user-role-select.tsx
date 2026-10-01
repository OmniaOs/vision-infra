import { USER_ROLE_METADATA } from '@/shared/domain/user-role-metadata'
import { USER_ROLES, type UserRole } from '@/shared/types/user-role'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

interface UserRoleSelectProps {
  id: string
  value: UserRole
  onChange: (role: UserRole) => void
}

/** Selector de rol que explica, debajo, que puede hacer el rol elegido. */
export function UserRoleSelect({ id, value, onChange }: UserRoleSelectProps) {
  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={(next) => onChange(next as UserRole)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {USER_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {USER_ROLE_METADATA[role].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{USER_ROLE_METADATA[value].description}</p>
    </div>
  )
}
