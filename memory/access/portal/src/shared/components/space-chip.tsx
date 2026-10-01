import { X } from 'lucide-react'
import { describeSpace, type SpaceKind } from '@/shared/domain/space-metadata'
import { cn } from '@/shared/lib/cn'

const KIND_DOT: Record<SpaceKind, string> = { project: 'bg-primary', internal: 'bg-muted-foreground', client: 'bg-amber' }

interface SpaceChipProps {
  space: string
  onRemove?: () => void
}

/** Un espacio como etiqueta: punto de color segun su tipo (proyecto, interno o cliente). */
export function SpaceChip({ space, onRemove }: SpaceChipProps) {
  const { kind, name, kindLabel } = describeSpace(space)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 py-0.5 pl-2 pr-2 text-xs" title={`${kindLabel}: ${name}`}>
      <span className={cn('size-1.5 rounded-full', KIND_DOT[kind])} aria-hidden />
      <span className="font-mono">{space}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="-mr-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={`Quitar ${space}`}>
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}
