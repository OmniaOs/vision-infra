import { motion } from 'framer-motion'
import type { MemoryGraph } from '../types/graph-types'
import { usePanZoom } from '../hooks/use-pan-zoom'
import { GraphZoomControls } from './graph-zoom-controls'

interface MemoryGraphCanvasProps {
  graph: MemoryGraph
  selectedId?: string
  /** Ids que coinciden con la busqueda; `null` = sin busqueda (todo visible). */
  matches: Set<string> | null
  onSelect: (id: string | undefined) => void
}

/** Grafo en SVG: categorias como nucleos grandes y memorias alrededor. Rueda = zoom, arrastrar = mover. */
export function MemoryGraphCanvas({ graph, selectedId, matches, onSelect }: MemoryGraphCanvasProps) {
  const { svgRef, transform, handlers, zoomBy, reset, wasDragged } = usePanZoom()
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card bg-dot-grid">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${graph.width} ${graph.height}`}
        className="h-[34rem] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label="Grafo de memorias agrupadas por categoría"
        {...handlers}
        onClick={() => !wasDragged() && onSelect(undefined)}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          {graph.edges.map((edge) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (!from || !to) return null
            const dim = matches !== null && !matches.has(edge.from)
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="stroke-primary"
                strokeWidth={edge.secondary ? 0.6 : 0.9}
                strokeDasharray={edge.secondary ? '3 3' : undefined}
                opacity={dim ? 0.04 : edge.secondary ? 0.25 : 0.4}
              />
            )
          })}
          {graph.nodes.map((node, index) => {
            const selected = node.id === selectedId
            const dim = matches !== null && node.kind === 'memory' && !matches.has(node.id)
            const delay = Math.min(index * 0.004, 0.8)
            return (
              <g
                key={node.id}
                onClick={(event) => {
                  event.stopPropagation()
                  if (!wasDragged() && node.kind === 'memory') onSelect(selected ? undefined : node.id)
                }}
                className={node.kind === 'memory' ? 'cursor-pointer' : undefined}
              >
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: selected ? node.radius * 1.9 : node.radius, opacity: dim ? 0.12 : 1 }}
                  whileHover={node.kind === 'memory' ? { r: node.radius * 1.9 } : undefined}
                  transition={{ delay: selected ? 0 : delay, type: 'spring', stiffness: 260, damping: 22 }}
                  className={node.kind === 'hub' ? 'fill-primary/25 stroke-primary' : selected ? 'fill-amber stroke-amber' : 'fill-primary stroke-transparent'}
                  strokeWidth={node.kind === 'hub' ? 1.5 : 0}
                />
                {node.kind === 'hub' ? (
                  <text x={node.x} y={node.y + node.radius + 14} textAnchor="middle" className="fill-foreground text-[11px] font-medium" pointerEvents="none">
                    {node.label} · {node.count}
                  </text>
                ) : (
                  <title>{node.label}</title>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <GraphZoomControls onZoomIn={() => zoomBy(1.4)} onZoomOut={() => zoomBy(1 / 1.4)} onReset={reset} />
      <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-primary bg-primary/25" /> Categoría
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> Memoria
        </span>
      </div>
    </div>
  )
}
