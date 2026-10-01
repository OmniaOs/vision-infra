import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { ThemeProvider } from '@/shared/theme/theme-provider'
import { Toaster } from '@/shared/toast/toaster'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { createQueryClient } from './create-query-client'

/** Todo lo que las pantallas dan por hecho: datos, tema, tooltips, avisos y respeto a "reducir movimiento". */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}
