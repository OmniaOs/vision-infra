import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { AnimatedNumber } from '@/shared/motion/animated-number'
import { fadeUpVariants, springSnappy } from '@/shared/motion/motion-presets'
import { Card } from '@/shared/ui/card'

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  tone?: 'primary' | 'amber' | 'success' | 'muted'
  hint?: string
}

const TONES = {
  primary: 'bg-primary/12 text-primary',
  amber: 'bg-amber/15 text-amber',
  success: 'bg-success/15 text-success',
  muted: 'bg-muted text-muted-foreground',
} as const

/** Cifra grande con icono. Se levanta al pasar el cursor y el numero cuenta hasta su valor. */
export function StatCard({ label, value, icon: Icon, tone = 'primary', hint }: StatCardProps) {
  return (
    <motion.div variants={fadeUpVariants} whileHover={{ y: -3 }} transition={springSnappy}>
      <Card className="relative overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-4xl font-semibold leading-none tracking-tight">
              <AnimatedNumber value={value} />
            </p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <div className={cn('flex size-11 items-center justify-center rounded-xl', TONES[tone])}>
            <Icon className="size-5" aria-hidden />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
