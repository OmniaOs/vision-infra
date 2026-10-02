import { useEffect, useState } from 'react'

export interface CanvasThemeColors {
  foreground: string
  muted: string
  background: string
}

function read(): CanvasThemeColors {
  const style = getComputedStyle(document.documentElement)
  const color = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim()
    return value ? `hsl(${value})` : fallback
  }
  return { foreground: color('--foreground', '#e5e7eb'), muted: color('--muted-foreground', '#94a3b8'), background: color('--card', '#0f1517') }
}

/** El canvas no entiende variables CSS: se leen del tema y se actualizan cuando cambia entre claro y oscuro. */
export function useCanvasThemeColors(): CanvasThemeColors {
  const [colors, setColors] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => observer.disconnect()
  }, [])
  return colors
}
