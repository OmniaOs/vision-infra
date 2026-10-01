import { CalendarDays, Tag, UserRound } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'

const text = (value: unknown): string | null => (typeof value === 'string' || typeof value === 'number' ? String(value) : null)

/** Lo que Basic Memory guarda en el encabezado de la nota: tipo, estado, fecha, autor y etiquetas. */
export function NoteMetadata({ frontmatter }: { frontmatter: Record<string, unknown> }) {
  const type = text(frontmatter.type)
  const status = text(frontmatter.status)
  const date = text(frontmatter.date)
  const author = text(frontmatter.author)
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String).slice(0, 12) : []
  if (!type && !status && !date && !author && tags.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {type ? <Badge variant="amber">{type}</Badge> : null}
      {status ? <Badge variant={status === 'resolved' || status === 'done' ? 'success' : 'outline'}>{status}</Badge> : null}
      {date ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden /> {date}
        </span>
      ) : null}
      {author ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className="size-3.5" aria-hidden /> {author}
        </span>
      ) : null}
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Tag className="size-3" aria-hidden /> {tag}
        </span>
      ))}
    </div>
  )
}
