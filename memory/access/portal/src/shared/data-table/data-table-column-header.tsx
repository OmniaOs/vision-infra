import type { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

interface DataTableColumnHeaderProps<TData, TValue> extends HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

/** Cabecera de columna: indica el orden actual y ofrece ordenar u ocultar la columna. */
export function DataTableColumnHeader<TData, TValue>({ column, title, className }: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) return <div className={cn(className)}>{title}</div>

  const sorted = column.getIsSorted()
  return (
    <div className={cn('flex items-center', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            {title}
            {sorted === 'desc' ? <ArrowDown /> : sorted === 'asc' ? <ArrowUp /> : <ChevronsUpDown className="opacity-50" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp /> Ascendente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown /> Descendente
          </DropdownMenuItem>
          {column.getCanHide() ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff /> Ocultar columna
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
