import type { FilterFn } from '@tanstack/react-table'
import type { UserRecord } from '@/shared/types/user-record'

/** La busqueda de la tabla mira el usuario, el rol y los espacios. */
export const usersGlobalFilter: FilterFn<UserRecord> = (row, _columnId, value) => {
  const needle = String(value).trim().toLowerCase()
  if (!needle) return true
  const { id, role, spaces } = row.original
  return [id, role, ...spaces].some((text) => text.toLowerCase().includes(needle))
}
