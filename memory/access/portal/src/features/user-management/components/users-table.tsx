import { useMemo } from 'react'
import { DataTable } from '@/shared/data-table/data-table'
import { USER_ROLE_METADATA } from '@/shared/domain/user-role-metadata'
import type { UserRecord } from '@/shared/types/user-record'
import { USER_ROLES } from '@/shared/types/user-role'
import { usersGlobalFilter } from '../lib/users-global-filter'
import type { UserAction } from './user-row-actions'
import { createUsersTableColumns } from './users-table-columns'

interface UsersTableProps {
  users: UserRecord[]
  isLoading: boolean
  currentUserId: string
  onAction: (action: UserAction, user: UserRecord) => void
}

const ROLE_OPTIONS = USER_ROLES.map((role) => ({ value: role, label: USER_ROLE_METADATA[role].label }))
const PORTAL_OPTIONS = [
  { value: 'with-access', label: 'Con acceso' },
  { value: 'pending', label: 'Sin contraseña' },
]

export function UsersTable({ users, isLoading, currentUserId, onAction }: UsersTableProps) {
  const columns = useMemo(() => createUsersTableColumns({ currentUserId, onAction }), [currentUserId, onAction])
  return (
    <DataTable
      columns={columns}
      data={users}
      isLoading={isLoading}
      getRowId={(user) => user.id}
      searchPlaceholder="Buscar por usuario, rol o espacio"
      globalFilterFn={usersGlobalFilter}
      facetedFilters={[
        { columnId: 'role', title: 'Rol', options: ROLE_OPTIONS },
        { columnId: 'portal', title: 'Portal', options: PORTAL_OPTIONS },
      ]}
      initialColumnVisibility={{ createdAt: false }}
      emptyTitle="Nadie coincide"
      emptyDescription="Prueba con otra búsqueda o quita los filtros."
    />
  )
}
