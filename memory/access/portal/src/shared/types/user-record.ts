import type { UserRole } from './user-role'

/** Origen de la persona: variable de Coolify (env, admins) o archivo gestionado desde el portal (file). */
export type UserOrigin = 'env' | 'file' | 'admins'

export interface UserRecord {
  id: string
  role: UserRole
  spaces: string[]
  origin: UserOrigin
  editable: boolean
  createdAt: string | null
  /** Ya tiene contrasena del portal. */
  portal: boolean
  /** Tokens activos (los de Coolify cuentan). */
  tokenCount: number
  lastUsedAt: string | null
}
