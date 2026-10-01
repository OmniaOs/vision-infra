import { motion } from 'framer-motion'
import { FormField } from '@/shared/components/form-field'
import type { SpaceKind } from '@/shared/domain/space-metadata'
import type { UserRole } from '@/shared/types/user-role'
import { SpacePicker } from './space-picker'
import { UserRoleSelect } from './user-role-select'

interface UserPermissionsFieldsProps {
  idPrefix: string
  role: UserRole
  spaces: string[]
  onChange: (next: { role: UserRole; spaces: string[] }) => void
}

/** Rol + espacios. Los clientes solo admiten espacios de cliente y los administradores no necesitan espacios. */
export function UserPermissionsFields({ idPrefix, role, spaces, onChange }: UserPermissionsFieldsProps) {
  const allowedKinds: SpaceKind[] = role === 'cliente' ? ['client'] : ['internal', 'project', 'client']

  const handleRoleChange = (nextRole: UserRole) => {
    const kept = nextRole === 'admin' ? [] : nextRole === 'cliente' ? spaces.filter((space) => space.startsWith('cli-')) : spaces
    onChange({ role: nextRole, spaces: kept })
  }

  return (
    <div className="space-y-5">
      <FormField label="Rol" htmlFor={`${idPrefix}-role`}>
        <UserRoleSelect id={`${idPrefix}-role`} value={role} onChange={handleRoleChange} />
      </FormField>
      {role === 'admin' ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
          Los administradores ven todos los espacios; no hace falta asignarles ninguno.
        </motion.p>
      ) : (
        <FormField
          label="Espacios"
          htmlFor={`${idPrefix}-space-name`}
          hint={role === 'cliente' ? 'Un cliente solo puede tener espacios de cliente (cli-…).' : 'Además del espacio global, que ya tienen por defecto.'}
        >
          <SpacePicker value={spaces} onChange={(next) => onChange({ role, spaces: next })} allowedKinds={allowedKinds} />
        </FormField>
      )}
    </div>
  )
}
