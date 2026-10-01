import { BookOpenText } from 'lucide-react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { EmptyState } from '@/shared/components/empty-state'
import { MarkdownContent } from '@/shared/components/markdown-content'
import { FadeIn } from '@/shared/motion/fade-in'
import { Skeleton } from '@/shared/ui/skeleton'
import { useNote } from '../hooks/use-note'
import { NoteMetadata } from './note-metadata'

interface NoteViewerProps {
  project?: string
  permalink?: string
}

export function NoteViewer({ project, permalink }: NoteViewerProps) {
  const { data: note, isLoading, error } = useNote(project, permalink)

  if (!permalink) {
    return <EmptyState icon={BookOpenText} title="Elige una nota" description="Selecciónala en el árbol de la izquierda para leerla aquí, sin clonar nada." />
  }
  if (isLoading) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (error || !note) {
    return (
      <p className="p-4 text-sm text-destructive" role="alert">
        {error ? describeApiError(error) : 'No se encontró la nota.'}
      </p>
    )
  }
  return (
    <FadeIn key={note.permalink} className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight">{note.title}</h2>
        <NoteMetadata frontmatter={note.frontmatter} />
        <p className="font-mono text-xs text-muted-foreground">{note.path}</p>
      </div>
      <MarkdownContent markdown={note.content} />
    </FadeIn>
  )
}
