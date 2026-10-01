import { useMemo } from 'react'
import { DataTable } from '@/shared/data-table/data-table'
import type { TokenRecord } from '@/shared/types/token-record'
import type { TokenScope } from '../types/token-scope'
import { TOKEN_STATUS_LABEL } from '../lib/token-status'
import { tokensGlobalFilter } from '../lib/tokens-global-filter'
import { createTokensTableColumns } from './tokens-table-columns'

interface TokensTableProps {
  tokens: TokenRecord[]
  isLoading: boolean
  scope: TokenScope
  onRevoke: (token: TokenRecord) => void
  /** Busqueda con la que arranca la tabla (por ejemplo, la persona elegida desde Personas). */
  initialSearch?: string
}

const STATUS_OPTIONS = Object.entries(TOKEN_STATUS_LABEL).map(([value, label]) => ({ value, label }))

export function TokensTable({ tokens, isLoading, scope, onRevoke, initialSearch }: TokensTableProps) {
  const columns = useMemo(() => createTokensTableColumns({ onRevoke }), [onRevoke])
  const people = useMemo(() => [...new Set(tokens.map((token) => token.userId))].sort().map((id) => ({ value: id, label: id })), [tokens])
  return (
    <DataTable
      columns={columns}
      data={tokens}
      isLoading={isLoading}
      getRowId={(token) => token.tid}
      searchPlaceholder="Buscar por nombre, persona, IP o cliente"
      globalFilterFn={tokensGlobalFilter}
      initialGlobalFilter={initialSearch}
      // En "Mis tokens" todas las filas son de la misma persona: la columna sobra.
      initialColumnVisibility={scope === 'mine' ? { userId: false } : {}}
      facetedFilters={[
        { columnId: 'status', title: 'Estado', options: STATUS_OPTIONS },
        ...(scope === 'admin' ? [{ columnId: 'userId', title: 'Persona', options: people }] : []),
      ]}
      emptyTitle="Sin tokens"
      emptyDescription="Crea uno con «Nuevo token» o quita los filtros."
    />
  )
}
