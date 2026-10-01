import { motion, type HTMLMotionProps } from 'framer-motion'
import { staggerContainer } from './motion-presets'

interface StaggerGroupProps extends HTMLMotionProps<'div'> {
  stagger?: number
  delay?: number
}

/** Contenedor que revela a sus StaggerItem uno tras otro. */
export function StaggerGroup({ stagger = 0.07, delay = 0, children, ...rest }: StaggerGroupProps) {
  return (
    <motion.div variants={staggerContainer(stagger, delay)} initial="hidden" animate="visible" {...rest}>
      {children}
    </motion.div>
  )
}
