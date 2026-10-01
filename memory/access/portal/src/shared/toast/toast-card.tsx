import { motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { springSnappy } from '@/shared/motion/motion-presets'
import { dismissToast, type ToastItem } from './toast-store'

const KIND_STYLES = {
  success: { icon: CircleCheck, accent: 'text-success', bar: 'bg-success' },
  error: { icon: CircleAlert, accent: 'text-destructive', bar: 'bg-destructive' },
  info: { icon: Info, accent: 'text-primary', bar: 'bg-primary' },
} as const

export function ToastCard({ toast }: { toast: ToastItem }) {
  const { icon: Icon, accent, bar } = KIND_STYLES[toast.kind]
  return (
    <motion.div
      layout
      role={toast.kind === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, x: 48, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.18 } }}
      transition={springSnappy}
      className="pointer-events-auto relative flex w-full max-w-sm gap-3 overflow-hidden rounded-xl border bg-popover p-4 pl-5 shadow-2xl"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', bar)} aria-hidden />
      <Icon className={cn('mt-0.5 size-5 shrink-0', accent)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        {toast.description ? <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="-mr-1 -mt-1 size-7 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Cerrar aviso"
      >
        <X className="mx-auto size-4" />
      </button>
    </motion.div>
  )
}
