import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { AnimatePresence } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { AnimatedTableRow, animatedRowMotion } from './animated-table-row'
import { DataTableEmptyState } from './data-table-empty-state'
import { DataTablePagination } from './data-table-pagination'
import { DataTableSkeleton } from './data-table-skeleton'
import { DataTableToolbar, type FacetedFilterConfig } from './data-table-toolbar'

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  isLoading?: boolean
  /** Identificador estable de cada fila (para que las animaciones no salten al reordenar). */
  getRowId: (row: TData) => string
  searchPlaceholder: string
  globalFilterFn: FilterFn<TData>
  facetedFilters?: FacetedFilterConfig[]
  toolbarTrailing?: ReactNode
  emptyTitle: string
  emptyDescription: string
  initialColumnVisibility?: VisibilityState
  /** Busqueda con la que arranca la tabla. */
  initialGlobalFilter?: string
}

/**
 * Tabla de datos completa (TanStack Table): orden, busqueda global, filtros por faceta, columnas
 * visibles, seleccion de filas y paginacion. Cada pieza vive en su propio archivo de esta carpeta.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  getRowId,
  searchPlaceholder,
  globalFilterFn,
  facetedFilters = [],
  toolbarTrailing,
  emptyTitle,
  emptyDescription,
  initialColumnVisibility = {},
  initialGlobalFilter = '',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility)
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter)

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const visibleColumns = table.getVisibleLeafColumns().length
  const rows = table.getRowModel().rows

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} searchPlaceholder={searchPlaceholder} facetedFilters={facetedFilters} trailing={toolbarTrailing} />
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <DataTableSkeleton columns={visibleColumns} />
            ) : rows.length === 0 ? (
              <DataTableEmptyState columns={visibleColumns} title={emptyTitle} description={emptyDescription} />
            ) : (
              <AnimatePresence initial={false}>
                {rows.map((row) => (
                  <AnimatedTableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined} {...animatedRowMotion}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </AnimatedTableRow>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}

