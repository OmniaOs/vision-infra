import { useEffect, useState } from 'react'

/**
 * Ancho y alto actuales de un elemento (el canvas del grafo necesita medidas en pixeles).
 * `ref` es una funcion: asi se mide aunque el elemento aparezca mas tarde (por ejemplo, al terminar de cargar datos).
 */
export function useElementSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return { ref: setElement, ...size }
}
