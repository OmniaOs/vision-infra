import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

/** Marcador de carga con un pulso suave (Framer Motion, sin estilos en linea). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn('rounded-lg bg-muted', className)}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    />
  )
}
