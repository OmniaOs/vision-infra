import { Network, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { describeApiError } from '@/shared/api/describe-api-error'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { GraphSpaceSelect } from '../components/graph-space-select'
import { MemoryDetailPanel } from '../components/memory-detail-panel'
import { MemoryGraphCanvas } from '../components/memory-graph-canvas'
import { useGraphSpaces } from '../hooks/use-graph-spaces'
import { useMemories } from '../hooks/use-memories'
import { buildMemoryGraph, matchMemories } from '../lib/build-memory-graph'

export function MemoryGraphPage() {
  const [params, setParams] = useSearchParams()
  const { data: spaces, isLoading: loadingSpaces, error: spacesError } = useGraphSpaces()
  const space = params.get('space') ?? spaces?.[0]
  const { data, isLoading, error } = useMemories(space)
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')

  const memories = data?.memories
  const graph = useMemo(() => buildMemoryGraph(memories ?? []), [memories])
  const matches = useMemo(() => matchMemories(memories ?? [], query), [memories, query])
  const selected = memories?.find((memory) => memory.id === selectedId)
  const categories = graph.nodes.filter((node) => node.kind === 'hub').length

  const changeSpace = (next: string) => {
    setSelectedId(undefined)
    setQuery('')
    setParams({ space: next })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grafo de memoria"
        description="Las lecciones cortas de Mem0 agrupadas por categoría. Acerca con la rueda, arrastra para moverte y toca un punto para leerlo."
        actions={spaces?.length ? <GraphSpaceSelect spaces={spaces} value={space} onChange={changeSpace} /> : undefined}
      />
      {spacesError || error ? (
        <p className="text-sm text-destructive" role="alert">
          {describeApiError(spacesError ?? error)}
        </p>
      ) : null}
      {loadingSpaces || isLoading ? (
        <Skeleton className="h-[34rem] w-full" />
      ) : !memories?.length ? (
        <Card>
          <EmptyState icon={Network} title="Este espacio aún no tiene memorias" description="Cuando se guarden lecciones con Mem0 aparecerán aquí como un grafo." />
        </Card>
      ) : (
        <FadeIn delay={0.1} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en las memorias" aria-label="Buscar en las memorias" className="h-9 pl-9" />
            </div>
            <p className="text-sm text-muted-foreground">
              {data?.total} memorias · {categories} categorías{matches ? ` · ${matches.size} coinciden` : ''}
            </p>
          </div>
          <MemoryGraphCanvas graph={graph} selectedId={selectedId} matches={matches} onSelect={setSelectedId} />
          <MemoryDetailPanel memory={selected} />
        </FadeIn>
      )}
    </div>
  )
}
