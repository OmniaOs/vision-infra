import { AnimatePresence } from 'framer-motion'
import { Network, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { describeApiError } from '@/shared/api/describe-api-error'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { GraphSpaceSelect } from '../components/graph-space-select'
import { GraphTopicLegend } from '../components/graph-topic-legend'
import { GraphZoomControls } from '../components/graph-zoom-controls'
import { MemoryForceGraph, type MemoryForceGraphHandle, type NodeAnchor } from '../components/memory-force-graph'
import { MemoryNodePopover } from '../components/memory-node-popover'
import { useElementSize } from '../hooks/use-element-size'
import { useGraphSpaces } from '../hooks/use-graph-spaces'
import { useMemories } from '../hooks/use-memories'
import { buildForceGraphData, matchMemories, relatedMemoryIds } from '../lib/build-force-graph-data'

export function MemoryGraphPage() {
  const [params, setParams] = useSearchParams()
  const { data: spaces, isLoading: loadingSpaces, error: spacesError } = useGraphSpaces()
  const space = params.get('space') ?? spaces?.find((candidate) => candidate.count > 0)?.id ?? spaces?.[0]?.id
  const { data, isLoading, error } = useMemories(space)
  const { ref: stageRef, width, height } = useElementSize<HTMLDivElement>()
  const graph = useRef<MemoryForceGraphHandle>(null)

  const [selectedId, setSelectedId] = useState<string>()
  const [hoveredId, setHoveredId] = useState<string>()
  const [focusTopicId, setFocusTopicId] = useState<string>()
  const [anchor, setAnchor] = useState<NodeAnchor | null>(null)
  const [query, setQuery] = useState('')
  const pressedAt = useRef<{ x: number; y: number } | null>(null)

  const graphData = useMemo(() => (data ? buildForceGraphData(data) : undefined), [data])
  const matches = useMemo(() => (data ? matchMemories(data, query) : null), [data, query])
  const topics = useMemo(() => graphData?.nodes.filter((node) => node.kind === 'topic') ?? [], [graphData])
  const byId = useMemo(() => new Map(graphData?.nodes.map((node) => [node.id, node]) ?? []), [graphData])
  const memoriesById = useMemo(() => new Map(data?.memories.map((memory) => [memory.id, memory]) ?? []), [data])

  const shownId = selectedId ?? hoveredId
  const shown = shownId ? byId.get(shownId) : undefined
  const related = useMemo(
    () => (data && selectedId ? relatedMemoryIds(data, selectedId).flatMap((id) => memoriesById.get(id) ?? []) : []),
    [data, selectedId, memoriesById],
  )

  const reset = useCallback(() => {
    setSelectedId(undefined)
    setHoveredId(undefined)
    setFocusTopicId(undefined)
    setAnchor(null)
    setQuery('')
  }, [])
  useEffect(reset, [space, reset])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelectedId(undefined)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSelect = (id: string | undefined) => {
    if (id?.startsWith('topic:')) {
      const topicId = byId.get(id)?.topicId
      setFocusTopicId((current) => (current === topicId ? undefined : topicId))
      setSelectedId(undefined)
      return
    }
    setSelectedId(id === selectedId ? undefined : id)
    if (id) graph.current?.focusNode(id)
  }

  // El clic lo resuelve la pagina con el nodo que ya esta bajo el cursor (el de la vista previa). Un arrastre
  // (mover el lienzo) no cuenta como clic.
  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const start = pressedAt.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return
    handleSelect(hoveredId)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Grafo de memoria"
        description="Las lecciones cortas de Mem0 organizadas por tema. Pasa el cursor sobre un punto para ver su resumen y haz clic para leerla completa."
        actions={spaces?.length ? <GraphSpaceSelect spaces={spaces} value={space} onChange={(next) => setParams({ space: next })} /> : undefined}
      />
      {spacesError || error ? (
        <p className="text-sm text-destructive" role="alert">
          {describeApiError(spacesError ?? error)}
        </p>
      ) : null}
      {loadingSpaces || isLoading ? (
        <Skeleton className="h-[34rem] w-full" />
      ) : !data?.memories.length || !graphData ? (
        <Card>
          <EmptyState icon={Network} title="Este espacio aún no tiene memorias" description="Elige otro espacio en la lista (cada uno muestra cuántas memorias tiene) o guarda lecciones con Mem0." />
        </Card>
      ) : (
        <FadeIn delay={0.1} className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <GraphTopicLegend topics={topics} focusTopicId={focusTopicId} onFocus={setFocusTopicId} />
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en las memorias" aria-label="Buscar en las memorias" className="h-9 pl-9" />
              </div>
              <p className="text-xs text-muted-foreground">
                {data.total} memorias · {topics.length} temas{matches ? ` · ${matches.size} coinciden` : ''}
              </p>
            </div>
          </div>

          <div
            ref={stageRef}
            onPointerDown={(event) => (pressedAt.current = { x: event.clientX, y: event.clientY })}
            onClick={handleStageClick}
            className="relative h-[calc(100vh-19rem)] min-h-[30rem] overflow-hidden rounded-2xl border bg-card bg-dot-grid">
            {width > 0 ? (
              <MemoryForceGraph
                ref={graph}
                data={graphData}
                width={width}
                height={height}
                selectedId={selectedId}
                hoveredId={hoveredId}
                focusTopicId={focusTopicId}
                matches={matches}
                onHover={setHoveredId}
                onAnchor={setAnchor}
              />
            ) : null}
            <GraphZoomControls onZoomIn={() => graph.current?.zoomBy(1.5)} onZoomOut={() => graph.current?.zoomBy(1 / 1.5)} onFit={() => graph.current?.fit()} />
            <AnimatePresence>
              {shown && anchor ? (
                <MemoryNodePopover
                  key={shown.id}
                  node={shown}
                  anchor={anchor}
                  bounds={{ width, height }}
                  pinned={Boolean(selectedId)}
                  related={related}
                  topicLabel={shown.kind === 'memory' ? byId.get(`topic:${shown.topicId}`)?.label : undefined}
                  onJump={handleSelect}
                  onClose={() => setSelectedId(undefined)}
                />
              ) : null}
            </AnimatePresence>
            <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-muted-foreground">Rueda: zoom · Arrastra: mover · Esc: cerrar tarjeta</p>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
