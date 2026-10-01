import { SearchX } from 'lucide-react'
import { EmptyState } from '@/shared/components/empty-state'
import { TableCell, TableRow } from '@/shared/ui/table'

/** Fila unica cuando no hay resultados (por filtros o porque no hay datos). */
export function DataTableEmptyState({ columns, title, description }: { columns: number; title: string; description: string }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columns} className="p-0">
        <EmptyState icon={SearchX} title={title} description={description} />
      </TableCell>
    </TableRow>
  )
}
