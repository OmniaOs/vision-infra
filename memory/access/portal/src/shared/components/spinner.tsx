import { motion } from 'framer-motion'
import { LoaderCircle } from 'lucide-react'

export function Spinner({ className }: { className?: string }) {
  return (
    <motion.span className="inline-flex" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
      <LoaderCircle className={className ?? 'size-4'} aria-hidden />
    </motion.span>
  )
}
