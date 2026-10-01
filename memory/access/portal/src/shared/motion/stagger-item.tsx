import { motion, type HTMLMotionProps } from 'framer-motion'
import { fadeUpVariants } from './motion-presets'

/** Elemento de un StaggerGroup: sube y aparece cuando le toca. */
export function StaggerItem({ children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={fadeUpVariants} {...rest}>
      {children}
    </motion.div>
  )
}
