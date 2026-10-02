import type { ColumnDef } from '@tanstack/react-table'
import { Link2, Unlink } from 'lucide-react'
import { useMemo } from 'react'
import { DataTable } from '@/shared/data-table/data-table'
import { DataTableColumnHeader } from '@/shared/data-table/data-table-column-header'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import type { AliasKind, NamespaceRow } from '../types/space-types'

interface NamespacesTableProps {
  kind: AliasKind
  rows: NamespaceRow[]
  isLoading: boolean
  onAssign: (row: NamespaceRow) => void
  onRemove: (row: NamespaceRow) => void
}

function statusOf(row: NamespaceRow) {
  return row.space ? 'assigned' : 'unassigned'
}

export function NamespacesTable({ kind, rows, isLoading, onAssign, onRemove }: NamespacesTableProps) {
  const columns = useMemo<ColumnDef<NamespaceRow, unknown>[]>(
    () => [
      {
        accessorKey: 'namespace',
        meta: { title: kind === 'kb' ? 'Proyecto de Basic Memory' : 'Namespace de Mem0' },
        header: ({ column }) => <DataTableColumnHeader column={column} title={kind === 'kb' ? 'Proyecto de Basic Memory' : 'Namespace de Mem0'} />,
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.namespace}</span>,
        enableHiding: false,
      },
      {
        accessorKey: 'count',
        meta: { title: 'Memorias' },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Memorias" />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.count ?? '—'}</span>,
      },
      {
        id: 'space',
        accessorFn: statusOf,
        meta: { title: 'Espacio' },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Espacio" />,
        cell: ({ row }) =>
          row.original.space ? (
            <Badge variant={row.original.aliased ? 'amber' : 'secondary'} className="font-mono">
              {row.original.space}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Sin asignar
            </Badge>
          ),
        filterFn: 'arrIncludesSome',
      },
      {
        id: 'origin',
        accessorFn: (row) => row.origin ?? '',
        meta: { title: 'Origen' },
        header: () => 'Origen',
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.origin === 'env' ? 'Coolify' : row.original.origin === 'file' ? 'Portal' : row.original.aliased ? '' : 'Nombre propio'}</span>,
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => null,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const { origin } = row.original
          if (origin === 'env') return <span className="text-xs text-muted-foreground">Coolify</span>
          if (!row.original.aliased && row.original.space) return null // ya es un espacio con su propio nombre
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onAssign(row.original)}>
                <Link2 /> {row.original.aliased ? 'Cambiar' : 'Asignar'}
              </Button>
              {row.original.aliased ? (
                <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onRemove(row.original)}>
                  <Unlink /> Quitar
                </Button>
              ) : null}
            </div>
          )
        },
      },
    ],
    [kind, onAssign, onRemove],
  )
  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      getRowId={(row) => row.namespace}
      searchPlaceholder="Buscar namespace o espacio"
      globalFilterFn={(row, _id, value) => `${row.original.namespace} ${row.original.space ?? ''}`.toLowerCase().includes(String(value).trim().toLowerCase())}
      facetedFilters={[{ columnId: 'space', title: 'Estado', options: [{ value: 'assigned', label: 'Asignado' }, { value: 'unassigned', label: 'Sin asignar' }] }]}
      emptyTitle="Sin namespaces"
      emptyDescription={kind === 'kb' ? 'Aún no hay proyectos de notas.' : 'Aún no hay memorias guardadas.'}
    />
  )
}
