import { motion, type HTMLMotionProps } from 'framer-motion'
import { easeOutExpo } from './motion-presets'

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number
  offsetY?: number
}

/** Aparece desde abajo con un fundido. Para bloques sueltos. */
export function FadeIn({ delay = 0, offsetY = 14, children, ...rest }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: offsetY }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: easeOutExpo }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
