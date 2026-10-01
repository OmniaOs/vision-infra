import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { easeOutExpo } from './motion-presets'

/** Cada pagina entra con un fundido corto; la salida es mas rapida para no hacer esperar. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOutExpo } }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
    >
      {children}
    </motion.div>
  )
}
