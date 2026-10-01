import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

/** Cuatro nodos conectados: el mismo motivo del icono de la pestana y del diagrama de arquitectura. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9', className)} role="img" aria-label="Memoria Omnia">
      <rect width="64" height="64" rx="16" className="fill-card" />
      <rect width="64" height="64" rx="16" className="fill-none stroke-border" strokeWidth="2" />
      <g className="stroke-primary" strokeWidth="3" strokeLinecap="round" opacity=".6">
        <path d="M20 22 L44 18 M20 22 L26 44 M44 18 L40 42 M26 44 L40 42" />
      </g>
      <motion.circle cx="20" cy="22" r="6" className="fill-primary" animate={{ r: [6, 7, 6] }} transition={{ duration: 3, repeat: Infinity }} />
      <circle cx="44" cy="18" r="5" className="fill-amber" />
      <circle cx="26" cy="44" r="5" className="fill-primary" />
      <motion.circle cx="40" cy="42" r="6" className="fill-primary" animate={{ r: [6, 7, 6] }} transition={{ duration: 3, repeat: Infinity, delay: 1.4 }} />
    </svg>
  )
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark />
      <div className="leading-tight">
        <p className="text-base font-semibold tracking-tight">Memoria Omnia</p>
        <p className="text-xs text-muted-foreground">Conocimiento compartido</p>
      </div>
    </div>
  )
}
