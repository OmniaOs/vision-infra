import { motion } from 'framer-motion'
import { FormField } from '@/shared/components/form-field'
import type { UserRole } from '@/shared/types/user-role'
import { SpacePicker } from './space-picker'
import { UserRoleSelect } from './user-role-select'

interface UserPermissionsFieldsProps {
  idPrefix: string
  role: UserRole
  spaces: string[]
  onChange: (next: { role: UserRole; spaces: string[] }) => void
}

/** Rol + espacios. Los administradores no necesitan espacios; un cliente ve solo los que se le asignan, nunca el global. */
export function UserPermissionsFields({ idPrefix, role, spaces, onChange }: UserPermissionsFieldsProps) {
  const handleRoleChange = (nextRole: UserRole) => {
    onChange({ role: nextRole, spaces: nextRole === 'admin' ? [] : spaces })
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
          hint={role === 'cliente' ? 'Un cliente solo ve los espacios que le asignes aquí. Nunca ve el global.' : 'Además del espacio global, que ya tienen por defecto.'}
        >
          <SpacePicker value={spaces} onChange={(next) => onChange({ role, spaces: next })} />
        </FormField>
      )}
    </div>
  )
}
