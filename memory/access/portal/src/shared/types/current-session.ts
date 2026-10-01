import type { UserRole } from './user-role'

export interface CurrentSession {
  id: string
  role: UserRole
  spaces: string[]
  via: 'cookie' | 'bearer'
  portal: boolean
  csrf?: string
}
