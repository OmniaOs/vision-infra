import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { UserRole } from '@/shared/types/user-role'
import { springSoft } from '@/shared/motion/motion-presets'
import { Button } from '@/shared/ui/button'
import { ShellSidebar } from './shell-sidebar'

/** Menu lateral deslizante para pantallas estrechas. Se cierra con Escape, al navegar o tocando fuera. */
export function MobileNavigation({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open}>
        <Menu />
      </Button>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 border-r bg-card shadow-2xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={springSoft}
            >
              <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => setOpen(false)} aria-label="Cerrar menú">
                <X />
              </Button>
              <ShellSidebar role={role} onNavigate={() => setOpen(false)} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
