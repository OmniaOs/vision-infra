import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { useCanvasThemeColors } from '../hooks/use-canvas-theme-colors'
import type { ForceGraphData, ForceLink, ForceNode } from '../types/graph-types'

export interface NodeAnchor {
  /** Posicion del nodo en pantalla, en pixeles dentro del lienzo. */
  x: number
  y: number
  radius: number
}

export interface MemoryForceGraphHandle {
  focusNode: (id: string) => void
  zoomBy: (factor: number) => void
  fit: () => void
}

interface MemoryForceGraphProps {
  data: ForceGraphData
  width: number
  height: number
  selectedId?: string
  hoveredId?: string
  /** Tema enfocado: lo demas se atenua. */
  focusTopicId?: string
  /** Ids de memorias que coinciden con la busqueda; `null` = sin busqueda. */
  matches: Set<string> | null
  onHover: (id: string | undefined) => void
  onAnchor: (anchor: NodeAnchor | null) => void
}

type FGNode = ForceNode & { x: number; y: number }
type FGLink = Omit<ForceLink, 'source' | 'target'> & { source: FGNode | string; target: FGNode | string }

/** Grafo de fuerzas (canvas): temas como nucleos, memorias alrededor, enlaces entre memorias parecidas. */
export const MemoryForceGraph = forwardRef<MemoryForceGraphHandle, MemoryForceGraphProps>(function MemoryForceGraph(
  { data, width, height, selectedId, hoveredId, focusTopicId, matches, onHover, onAnchor },
  handle,
) {
  const graphRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined)
  const colors = useCanvasThemeColors()
  const anchorId = selectedId ?? hoveredId
  const lastAnchor = useRef<NodeAnchor | null>(null)
  const fitted = useRef(false)
  // La libreria muta los nodos (les pone posicion): se le da una copia para no tocar los datos originales.
  const graphData = useMemo(() => ({ nodes: data.nodes.map((node) => ({ ...node })), links: data.links.map((link) => ({ ...link })) }), [data])

  useEffect(() => {
    fitted.current = false
    lastAnchor.current = null
  }, [data])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    graph.d3Force('charge')?.strength((node: FGNode) => (node.kind === 'topic' ? -60 : -42))
    const link = graph.d3Force('link') as unknown as { distance: (fn: (l: FGLink) => number) => unknown; strength: (fn: (l: FGLink) => number) => unknown } | undefined
    link?.distance((l) => (l.kind === 'membership' ? 38 : 120))
    link?.strength((l) => (l.kind === 'membership' ? 0.5 : 0.003))
    graph.d3ReheatSimulation()
  }, [graphData])

  /** Encuadra todo con margen para las etiquetas (el encuadre de la libreria solo cuenta el centro de cada nodo). */
  const fitAll = useCallback(
    (ms = 500) => {
      const graph = graphRef.current
      const placed = graphData.nodes.filter((node) => Number.isFinite((node as FGNode).x)) as FGNode[]
      if (!graph || placed.length === 0) return
      const minX = Math.min(...placed.map((n) => n.x - n.radius * 2))
      const maxX = Math.max(...placed.map((n) => n.x + n.radius * 2))
      const minY = Math.min(...placed.map((n) => n.y - n.radius * 2))
      const maxY = Math.max(...placed.map((n) => n.y + n.radius * 2 + (n.kind === 'topic' ? 34 : 0)))
      const zoom = Math.min(width / Math.max(maxX - minX, 1), height / Math.max(maxY - minY, 1)) * 0.9
      graph.centerAt((minX + maxX) / 2, (minY + maxY) / 2, ms)
      graph.zoom(Math.min(Math.max(zoom, 0.3), 4), ms)
    },
    [graphData, width, height],
  )

  useImperativeHandle(handle, () => ({
    focusNode: (id) => {
      const node = graphData.nodes.find((candidate) => candidate.id === id) as FGNode | undefined
      if (!node || node.x === undefined) return
      graphRef.current?.centerAt(node.x, node.y, 600)
      graphRef.current?.zoom(Math.max(graphRef.current.zoom(), 2.2), 600)
    },
    zoomBy: (factor) => graphRef.current?.zoom(graphRef.current.zoom() * factor, 250),
    fit: () => fitAll(),
  }))

  const dimmed = useCallback(
    (node: FGNode) => {
      if (matches !== null && node.kind === 'memory') return !matches.has(node.id)
      if (matches !== null && node.kind === 'topic') return true
      if (focusTopicId) return node.topicId !== focusTopicId
      return false
    },
    [matches, focusTopicId],
  )

  const paintNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
      // En los primeros cuadros la simulacion aun no les ha dado posicion: no hay nada que dibujar.
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return
      const faded = dimmed(node)
      const active = node.id === selectedId || node.id === hoveredId
      ctx.globalAlpha = faded ? 0.14 : 1
      if (node.kind === 'topic') {
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 1.9)
        gradient.addColorStop(0, `${node.color}55`)
        gradient.addColorStop(1, `${node.color}00`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * 1.9, 0, 2 * Math.PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI)
        ctx.fillStyle = colors.background
        ctx.fill()
        ctx.lineWidth = 1.8 / Math.sqrt(scale)
        ctx.strokeStyle = node.color
        ctx.stroke()
        const size = Math.max(11 / scale, 4)
        ctx.font = `600 ${size}px "Schibsted Grotesk Variable", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = colors.foreground
        ctx.fillText(node.label, node.x, node.y + node.radius + 3 / scale)
        ctx.font = `500 ${size * 0.85}px "Schibsted Grotesk Variable", system-ui, sans-serif`
        ctx.fillStyle = colors.muted
        ctx.fillText(`${node.topic?.size ?? 0} memorias`, node.x, node.y + node.radius + 3 / scale + size * 1.15)
      } else {
        if (active) {
          ctx.shadowColor = node.color
          ctx.shadowBlur = 18
        }
        ctx.beginPath()
        ctx.arc(node.x, node.y, active ? node.radius * 1.9 : node.radius, 0, 2 * Math.PI)
        ctx.fillStyle = node.color
        ctx.fill()
        ctx.shadowBlur = 0
        if (active) {
          ctx.lineWidth = 1.5 / scale
          ctx.strokeStyle = colors.foreground
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    },
    [colors, dimmed, hoveredId, selectedId],
  )

  const paintPointerArea = useCallback((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return
    ctx.fillStyle = color
    ctx.beginPath()
    // Area de toque mas generosa que el punto visible: seleccionar no debe exigir punteria.
    ctx.arc(node.x, node.y, node.kind === 'topic' ? node.radius + 4 : Math.max(node.radius * 2.6, 7), 0, 2 * Math.PI)
    ctx.fill()
  }, [])

  // Cada cuadro se recalcula donde esta en pantalla el nodo con la tarjeta, para que le siga al mover o acercar.
  const trackAnchor = useCallback(() => {
    const graph = graphRef.current
    if (!graph) return
    const node = anchorId ? (graphData.nodes.find((candidate) => candidate.id === anchorId) as FGNode | undefined) : undefined
    if (!node || node.x === undefined) {
      if (lastAnchor.current) { lastAnchor.current = null; onAnchor(null) }
      return
    }
    const screen = graph.graph2ScreenCoords(node.x, node.y)
    const radius = (node.kind === 'topic' ? node.radius : node.radius * 1.9) * graph.zoom()
    const previous = lastAnchor.current
    if (previous && Math.abs(previous.x - screen.x) < 0.5 && Math.abs(previous.y - screen.y) < 0.5 && Math.abs(previous.radius - radius) < 0.5) return
    lastAnchor.current = { x: screen.x, y: screen.y, radius }
    onAnchor(lastAnchor.current)
  }, [anchorId, graphData, onAnchor])

  useEffect(() => {
    lastAnchor.current = null
    trackAnchor()
  }, [anchorId, trackAnchor])

  const linkColor = useCallback(
    (link: FGLink) => {
      const target = link.target as FGNode
      const source = link.source as FGNode
      const faded = dimmed(source.kind === 'memory' ? source : target) && dimmed(target.kind === 'memory' ? target : source)
      if (link.kind === 'similarity') return faded ? 'rgba(148,163,184,0.03)' : 'rgba(148,163,184,0.32)'
      return faded ? `${target.color}08` : `${target.color}55`
    },
    [dimmed],
  )

  return (
    <ForceGraph2D<ForceNode, ForceLink>
      ref={graphRef as never}
      graphData={graphData as never}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      nodeLabel=""
      nodeRelSize={1}
      nodeCanvasObject={paintNode as never}
      nodeCanvasObjectMode={() => 'replace'}
      nodePointerAreaPaint={paintPointerArea as never}
      linkColor={linkColor as never}
      linkWidth={(link) => ((link as unknown as FGLink).kind === 'similarity' ? 0.9 : 0.6)}
      linkLineDash={(link) => ((link as unknown as FGLink).kind === 'similarity' ? [2, 2] : null)}
      warmupTicks={80}
      cooldownTime={2500}
      d3VelocityDecay={0.32}
      onEngineStop={() => {
        if (fitted.current) return
        fitted.current = true
        fitAll(500)
      }}
      onRenderFramePost={trackAnchor}
      onNodeHover={(node) => onHover(node ? (node as FGNode).id : undefined)}
      minZoom={0.3}
      maxZoom={8}
    />
  )
})
