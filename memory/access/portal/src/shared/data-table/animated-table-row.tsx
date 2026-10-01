import { motion } from 'framer-motion'
import { TableRow } from '@/shared/ui/table'

const MotionTableRow = motion.create(TableRow)

/** Fila que entra con un fundido, se recoloca suavemente al ordenar o filtrar y sale sin saltos. */
export const AnimatedTableRow = MotionTableRow
export const animatedRowMotion = {
  layout: 'position' as const,
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
  transition: { type: 'spring' as const, stiffness: 380, damping: 34 },
}
