import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { popInVariants } from '@/shared/motion/motion-presets'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div variants={popInVariants} initial="hidden" animate="visible" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </motion.div>
  )
}
