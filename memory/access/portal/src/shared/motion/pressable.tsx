import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { springSnappy } from './motion-presets'

/** Da respuesta fisica al pasar el cursor y al pulsar. Envuelve botones y tarjetas pulsables. */
export function Pressable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span className={className ?? 'inline-flex'} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={springSnappy}>
      {children}
    </motion.span>
  )
}
