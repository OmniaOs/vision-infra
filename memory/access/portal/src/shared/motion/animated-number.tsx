import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { easeOutExpo } from './motion-presets'

/** Cuenta desde el valor anterior hasta el nuevo. Escribe directo en el nodo para no re-renderizar. */
export function AnimatedNumber({ value }: { value: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return
    if (reduceMotion) {
      node.textContent = String(value)
      return
    }
    const controls = animate(Number(node.textContent) || 0, value, {
      duration: 0.9,
      ease: easeOutExpo,
      onUpdate: (latest) => {
        node.textContent = String(Math.round(latest))
      },
    })
    return () => controls.stop()
  }, [value, reduceMotion])

  return (
    <span ref={nodeRef} className="tabular">
      0
    </span>
  )
}
