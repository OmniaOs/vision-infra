import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/shared/data-table/data-table-column-header'
import { formatDate } from '@/shared/lib/format-date'
import type { UserRecord } from '@/shared/types/user-record'
import { UserIdentityCell } from './user-identity-cell'
import { UserPortalStatus } from './user-portal-status'
import { UserRoleBadge } from './user-role-badge'
import { UserRowActions, type UserAction } from './user-row-actions'
import { UserSpacesList } from './user-spaces-list'
import { UserTokensSummary } from './user-tokens-summary'

interface ColumnOptions {
  currentUserId: string
  onAction: (action: UserAction, user: UserRecord) => void
}

export function createUsersTableColumns({ currentUserId, onAction }: ColumnOptions): ColumnDef<UserRecord, unknown>[] {
  return [
    {
      accessorKey: 'id',
      meta: { title: 'Persona' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Persona" />,
      cell: ({ row }) => <UserIdentityCell user={row.original} />,
      enableHiding: false,
    },
    {
      accessorKey: 'role',
      meta: { title: 'Rol' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rol" />,
      cell: ({ row }) => <UserRoleBadge role={row.original.role} />,
      filterFn: 'arrIncludesSome',
    },
    {
      id: 'spaces',
      accessorFn: (user) => user.spaces.length,
      meta: { title: 'Espacios' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Espacios" />,
      cell: ({ row }) => <UserSpacesList role={row.original.role} spaces={row.original.spaces} />,
    },
    {
      id: 'tokens',
      accessorFn: (user) => user.lastUsedAt ?? '',
      meta: { title: 'Tokens' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tokens · último uso" />,
      cell: ({ row }) => <UserTokensSummary user={row.original} />,
    },
    {
      id: 'portal',
      accessorFn: (user) => (user.portal ? 'with-access' : 'pending'),
      meta: { title: 'Portal' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Portal" />,
      cell: ({ row }) => <UserPortalStatus hasPassword={row.original.portal} />,
      filterFn: 'arrIncludesSome',
    },
    {
      accessorKey: 'createdAt',
      meta: { title: 'Alta' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Alta" />,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => <UserRowActions user={row.original} isSelf={row.original.id === currentUserId} onAction={onAction} />,
      enableSorting: false,
      enableHiding: false,
    },
  ]
}
