import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BrandMark } from '@/shared/components/brand-logo'
import { MemoryConstellation } from './memory-constellation'

/** Pantalla de entrada: la red de nodos de fondo y una sola tarjeta centrada, sin mas texto que el necesario. */
export function AuthenticationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <MemoryConstellation className="absolute inset-0 size-full" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--background))_0%,hsl(var(--background)/0.7)_35%,transparent_75%)]"
        aria-hidden
      />
      <motion.main
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        className="relative z-10 w-full max-w-sm rounded-3xl border bg-card/75 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12" />
          <p className="text-sm font-medium tracking-tight text-muted-foreground">Memoria Omnia</p>
        </div>
        {children}
      </motion.main>
    </div>
  )
}
