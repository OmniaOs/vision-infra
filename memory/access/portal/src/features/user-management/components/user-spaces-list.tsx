import { SpaceChip } from '@/shared/components/space-chip'
import type { UserRole } from '@/shared/types/user-role'

const VISIBLE_LIMIT = 3

/** Espacios asignados. Los administradores ven todo y los miembros tienen siempre el espacio global. */
export function UserSpacesList({ role, spaces }: { role: UserRole; spaces: string[] }) {
  if (role === 'admin') return <span className="text-sm text-muted-foreground">Todos los espacios</span>
  if (spaces.length === 0) return <span className="text-sm text-muted-foreground">{role === 'cliente' ? 'Ninguno' : 'Solo el global'}</span>

  const shown = spaces.slice(0, VISIBLE_LIMIT)
  const hidden = spaces.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((space) => (
        <SpaceChip key={space} space={space} />
      ))}
      {hidden > 0 ? (
        <span className="text-xs text-muted-foreground" title={spaces.slice(VISIBLE_LIMIT).join(', ')}>
          +{hidden}
        </span>
      ) : null}
    </div>
  )
}
