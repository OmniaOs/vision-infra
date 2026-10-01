import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

interface Transform {
  x: number
  y: number
  k: number
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 6
const IDENTITY: Transform = { x: 0, y: 0, k: 1 }

/** Zoom con la rueda (centrado en el cursor) y arrastre para mover el lienzo SVG. */
export function usePanZoom() {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  // Sobrevive al soltar: el click que llega justo despues de arrastrar no debe seleccionar un nodo.
  const moved = useRef(false)
  const [transform, setTransform] = useState<Transform>(IDENTITY)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    // Nativo y no pasivo: React registra onWheel como pasivo y no dejaria evitar que la pagina se desplace.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const px = ((event.clientX - rect.left) / rect.width) * svg.viewBox.baseVal.width
      const py = ((event.clientY - rect.top) / rect.height) * svg.viewBox.baseVal.height
      setTransform((t) => {
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * Math.exp(-event.deltaY * 0.0015)))
        const ratio = k / t.k
        return { k, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, y: event.clientY }
    moved.current = false
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current
    const svg = svgRef.current
    if (!start || !svg) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!moved.current && Math.hypot(dx, dy) < 4) return
    moved.current = true
    const rect = svg.getBoundingClientRect()
    const scale = svg.viewBox.baseVal.width / rect.width
    start.x = event.clientX
    start.y = event.clientY
    setTransform((t) => ({ ...t, x: t.x + dx * scale, y: t.y + dy * scale }))
  }, [])

  const endDrag = useCallback(() => {
    drag.current = null
  }, [])

  const zoomBy = useCallback((factor: number) => {
    setTransform((t) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor))
      const ratio = k / t.k
      return { k, x: 500 - (500 - t.x) * ratio, y: 320 - (320 - t.y) * ratio }
    })
  }, [])

  const reset = useCallback(() => setTransform(IDENTITY), [])

  return { svgRef, transform, handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerLeave: endDrag }, zoomBy, reset, wasDragged: () => moved.current }
}
