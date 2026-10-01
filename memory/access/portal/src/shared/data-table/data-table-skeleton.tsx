import { Skeleton } from '@/shared/ui/skeleton'
import { TableCell, TableRow } from '@/shared/ui/table'

/** Filas de carga con el mismo numero de columnas que la tabla. */
export function DataTableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton className="h-5 w-full max-w-[10rem]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
