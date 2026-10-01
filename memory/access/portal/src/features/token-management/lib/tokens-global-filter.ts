import type { FilterFn } from '@tanstack/react-table'
import type { TokenRecord } from '@/shared/types/token-record'

/** La busqueda de la tabla mira el nombre, la persona, la IP y el cliente. */
export const tokensGlobalFilter: FilterFn<TokenRecord> = (row, _columnId, value) => {
  const needle = String(value).trim().toLowerCase()
  if (!needle) return true
  const { label, userId, lastIp, lastDevice } = row.original
  return [label, userId, lastIp, lastDevice].some((text) => text?.toLowerCase().includes(needle))
}
