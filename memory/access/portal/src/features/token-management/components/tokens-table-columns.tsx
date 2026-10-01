import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/shared/data-table/data-table-column-header'
import { formatDate } from '@/shared/lib/format-date'
import type { TokenRecord } from '@/shared/types/token-record'
import { getTokenStatus } from '../lib/token-status'
import { TokenLabelCell } from './token-label-cell'
import { TokenLastUseCell } from './token-last-use-cell'
import { TokenRowActions } from './token-row-actions'
import { TokenStatusBadge } from './token-status-badge'

interface ColumnOptions {
  onRevoke: (token: TokenRecord) => void
}

export function createTokensTableColumns({ onRevoke }: ColumnOptions): ColumnDef<TokenRecord, unknown>[] {
  return [
    {
      accessorKey: 'label',
      meta: { title: 'Token' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Token" />,
      cell: ({ row }) => <TokenLabelCell token={row.original} />,
      enableHiding: false,
    },
    {
      accessorKey: 'userId',
      meta: { title: 'Persona' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Persona" />,
      cell: ({ row }) => <span className="font-medium">{row.original.userId}</span>,
      filterFn: 'arrIncludesSome',
    },
    {
      id: 'status',
      accessorFn: getTokenStatus,
      meta: { title: 'Estado' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row }) => <TokenStatusBadge status={getTokenStatus(row.original)} />,
      filterFn: 'arrIncludesSome',
    },
    {
      accessorKey: 'createdAt',
      meta: { title: 'Creado' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Creado" />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'lastUsedAt',
      accessorFn: (token) => token.lastUsedAt ?? undefined,
      meta: { title: 'Último uso' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Último uso" />,
      cell: ({ row }) => <TokenLastUseCell token={row.original} />,
      sortUndefined: 'last',
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => <TokenRowActions token={row.original} onRevoke={onRevoke} />,
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
