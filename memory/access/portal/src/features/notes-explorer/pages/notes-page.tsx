import { BookOpenText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { describeApiError } from '@/shared/api/describe-api-error'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import { Card } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'
import { NoteProjectSelect } from '../components/note-project-select'
import { NoteTree } from '../components/note-tree'
import { NoteViewer } from '../components/note-viewer'
import { useNoteProjects } from '../hooks/use-note-projects'
import { useNotes } from '../hooks/use-notes'

/** La carpeta y la nota elegidas viven en la URL: se pueden compartir y el boton "atras" funciona. */
export function NotesPage() {
  const [params, setParams] = useSearchParams()
  const { data: projects, isLoading: loadingProjects, error } = useNoteProjects()
  const project = params.get('project') ?? projects?.[0]?.name
  const permalink = params.get('note') ?? undefined
  const { data: notes, isLoading: loadingNotes } = useNotes(project)

  const select = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) value ? merged.set(key, value) : merged.delete(key)
    setParams(merged, { replace: false })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas"
        description="Las notas largas de Basic Memory: incidentes, arquitectura y decisiones. Solo ves los espacios que te corresponden."
        actions={projects?.length ? <NoteProjectSelect projects={projects} value={project} onChange={(next) => select({ project: next, note: undefined })} /> : undefined}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {describeApiError(error)}
        </p>
      ) : null}
      {loadingProjects ? (
        <Skeleton className="h-96 w-full" />
      ) : !projects?.length ? (
        <Card>
          <EmptyState icon={BookOpenText} title="Sin espacios con notas" description="Cuando tengas acceso a un espacio con notas aparecerá aquí." />
        </Card>
      ) : (
        <FadeIn delay={0.1}>
          <Card className="grid min-h-[32rem] overflow-hidden lg:grid-cols-[19rem_1fr]">
            <aside className="border-b p-4 lg:max-h-[calc(100vh-14rem)] lg:border-b-0 lg:border-r">
              <NoteTree notes={notes} isLoading={loadingNotes} selectedPermalink={permalink} onSelect={(next) => select({ project, note: next })} />
            </aside>
            <section className="min-w-0 p-6 sm:p-8 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
              <NoteViewer project={project} permalink={permalink} />
            </section>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}
