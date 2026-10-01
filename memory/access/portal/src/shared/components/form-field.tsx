import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Label } from '@/shared/ui/label'

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
}

/** Etiqueta + control + ayuda o error. El error entra y sale con una transicion de altura. */
export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${htmlFor}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-sm text-destructive"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p key="hint" className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
