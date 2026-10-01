/** Roles del gateway (memory/PERMISOS.md). Los valores son los del servidor. */
export const USER_ROLES = ['admin', 'miembro', 'lectura', 'cliente'] as const

export type UserRole = (typeof USER_ROLES)[number]
