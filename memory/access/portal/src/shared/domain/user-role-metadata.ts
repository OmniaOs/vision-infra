import { Crown, Eye, Handshake, UsersRound, type LucideIcon } from 'lucide-react'
import type { UserRole } from '@/shared/types/user-role'

export interface UserRoleMetadata {
  label: string
  description: string
  badgeVariant: 'default' | 'secondary' | 'outline' | 'amber'
  icon: LucideIcon
}

/** Como se llama cada rol en pantalla y que puede hacer. Los codigos son los del servidor. */
export const USER_ROLE_METADATA: Record<UserRole, UserRoleMetadata> = {
  admin: { label: 'Administrador', description: 'Ve y administra todo, incluidas las altas y bajas.', badgeVariant: 'default', icon: Crown },
  miembro: { label: 'Miembro', description: 'Lee y escribe en el espacio global y en los que se le asignen.', badgeVariant: 'secondary', icon: UsersRound },
  lectura: { label: 'Solo lectura', description: 'Consulta el espacio global y los asignados, sin escribir.', badgeVariant: 'outline', icon: Eye },
  cliente: { label: 'Cliente', description: 'Lee y escribe solo en su propio espacio de cliente.', badgeVariant: 'amber', icon: Handshake },
}
