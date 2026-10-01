import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { copyToClipboard } from '@/shared/lib/copy-to-clipboard'
import { toast } from '@/shared/toast/toast'
import { Button } from '@/shared/ui/button'

interface CopyableSecretProps {
  label: string
  value: string
  /** Oculta el valor hasta que la persona lo pida. Util para tokens. */
  masked?: boolean
  className?: string
}

/** Muestra un valor largo en monoespaciado, con boton de copiar y, si se pide, ocultable. */
export function CopyableSecret({ label, value, masked = false, className }: CopyableSecretProps) {
  const [revealed, setRevealed] = useState(!masked)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(value)
    if (!ok) return toast.error('No se pudo copiar', 'Selecciona el texto y cópialo a mano.')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-stretch gap-1.5 rounded-xl border bg-muted/40 p-1.5">
        <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap px-2.5 py-2 font-mono text-xs leading-relaxed">
          {revealed ? value : '•'.repeat(Math.min(value.length, 48))}
        </code>
        {masked ? (
          <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => setRevealed((v) => !v)} aria-label={revealed ? 'Ocultar' : 'Mostrar'}>
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" size="icon" className="size-9" onClick={handleCopy} aria-label={`Copiar ${label}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'done' : 'idle'}
              initial={{ scale: 0.4, opacity: 0, rotate: -40 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="inline-flex"
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </div>
  )
}
