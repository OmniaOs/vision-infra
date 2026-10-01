import type { Table } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

const PAGE_SIZES = [5, 10, 20, 50]

/** Resumen de seleccion, tamano de pagina y navegacion. */
export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  const { pageIndex, pageSize } = table.getState().pagination
  const selected = table.getFilteredSelectedRowModel().rows.length
  const total = table.getFilteredRowModel().rows.length

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular text-sm text-muted-foreground">
        {selected > 0 ? `${selected} de ${total} seleccionadas` : `${total} ${total === 1 ? 'resultado' : 'resultados'}`}
      </p>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filas</span>
          <Select value={String(pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
            <SelectTrigger className="h-9 w-[4.5rem]" aria-label="Filas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="tabular text-sm font-medium">
          Página {pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-9" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="Primera página">
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Página anterior">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Página siguiente">
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon" className="size-9" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Última página">
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
