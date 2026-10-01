import type { Table } from '@tanstack/react-table'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

/** Elige que columnas se ven. El titulo de cada una sale de `meta.title` de la columna. */
export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  const hideable = table.getAllColumns().filter((column) => column.getCanHide())
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <SlidersHorizontal />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(visible) => column.toggleVisibility(visible === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {(column.columnDef.meta as { title?: string } | undefined)?.title ?? column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
