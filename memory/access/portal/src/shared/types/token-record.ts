/** Origen del token: `file` se gestiona desde el portal; `env` y `admins` vienen de Coolify y aqui solo se ven. */
export type TokenOrigin = 'file' | 'env' | 'admins'

export interface TokenRecord {
  tid: string
  userId: string
  label: string
  origin: TokenOrigin
  /** Se puede revocar desde el portal. */
  managed: boolean
  createdAt: string | null
  createdBy: string | null
  lastUsedAt: string | null
  lastIp: string | null
  /** Cliente que lo uso por ultima vez (su User-Agent). */
  lastDevice: string | null
  revokedAt: string | null
}
