import type { Table } from '@tanstack/react-table'
import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { DataTableFacetedFilter, type FacetOption } from './data-table-faceted-filter'
import { DataTableViewOptions } from './data-table-view-options'

export interface FacetedFilterConfig {
  columnId: string
  title: string
  options: FacetOption[]
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchPlaceholder: string
  facetedFilters: FacetedFilterConfig[]
  trailing?: ReactNode
}

/** Busqueda global, filtros por faceta, restablecer y visibilidad de columnas. */
export function DataTableToolbar<TData>({ table, searchPlaceholder, facetedFilters, trailing }: DataTableToolbarProps<TData>) {
  const state = table.getState()
  const isFiltered = state.columnFilters.length > 0 || Boolean(state.globalFilter)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={(state.globalFilter as string) ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 pl-9"
          />
        </div>
        {facetedFilters.map((filter) => (
          <DataTableFacetedFilter key={filter.columnId} column={table.getColumn(filter.columnId)} title={filter.title} options={filter.options} />
        ))}
        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter('')
            }}
          >
            Restablecer
            <X />
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {trailing}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
