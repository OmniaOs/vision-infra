import { motion } from 'framer-motion'
import { Check, Circle } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { evaluatePasswordStrength } from '@/shared/lib/evaluate-password-strength'

const SEGMENT_COLORS = ['bg-destructive', 'bg-destructive', 'bg-amber', 'bg-primary', 'bg-success'] as const

/** Barra de cuatro tramos y lista de requisitos que se marcan en vivo. */
export function PasswordStrengthMeter({ password, userId }: { password: string; userId?: string }) {
  const strength = evaluatePasswordStrength(password, userId)
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((segment) => (
            <div key={segment} className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn('h-full rounded-full', SEGMENT_COLORS[strength.score])}
                initial={false}
                animate={{ width: strength.score >= segment ? '100%' : '0%' }}
                transition={{ duration: 0.3, delay: strength.score >= segment ? segment * 0.04 : 0 }}
              />
            </div>
          ))}
        </div>
        <span className="w-16 text-right text-xs font-medium text-muted-foreground">{strength.label}</span>
      </div>
      <ul className="space-y-1.5">
        {strength.requirements.map((requirement) => (
          <li key={requirement.id} className={cn('flex items-center gap-2 text-xs transition-colors', requirement.met ? 'text-success' : 'text-muted-foreground')}>
            <motion.span key={String(requirement.met)} initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="inline-flex">
              {requirement.met ? <Check className="size-3.5" strokeWidth={3} /> : <Circle className="size-3.5" />}
            </motion.span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
