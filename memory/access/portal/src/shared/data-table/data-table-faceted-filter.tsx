import type { Column } from '@tanstack/react-table'
import { ListFilter } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

export interface FacetOption {
  value: string
  label: string
}

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title: string
  options: FacetOption[]
}

/** Filtro por varios valores a la vez, con el numero de filas que tiene cada uno. */
export function DataTableFacetedFilter<TData, TValue>({ column, title, options }: DataTableFacetedFilterProps<TData, TValue>) {
  if (!column) return null
  const counts = column.getFacetedUniqueValues()
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? [])

  const toggle = (value: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(value)
    else next.delete(value)
    column.setFilterValue(next.size ? [...next] : undefined)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 border-dashed">
          <ListFilter />
          {title}
          {selected.size > 0 ? (
            <Badge variant="default" className="px-1.5 py-0">
              {selected.size}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.has(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
            <span className="tabular ml-auto pl-3 text-xs text-muted-foreground">{counts.get(option.value) ?? 0}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
