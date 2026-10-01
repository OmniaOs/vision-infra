import type { Transition, Variants } from 'framer-motion'

/** Curva de salida muy suave: arranca rapido y se asienta despacio. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const

export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 26 }
export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 32 }

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOutExpo } },
}

export const popInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springSoft },
}

export function staggerContainer(stagger = 0.07, delay = 0): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }
}
