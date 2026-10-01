import { AnimatePresence } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { useCurrentSession } from '@/features/authentication/hooks/use-current-session'
import { PageTransition } from '@/shared/motion/page-transition'
import { ShellSidebar } from './shell-sidebar'
import { ShellTopbar } from './shell-topbar'

/** Marco de las paginas con sesion: barra lateral fija, barra superior y la pagina con su transicion. */
export function ApplicationShell() {
  const { data: session } = useCurrentSession()
  const location = useLocation()
  if (!session) return null

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r bg-card/60 lg:block">
        <ShellSidebar role={session.role} />
      </aside>
      <div className="min-w-0">
        <ShellTopbar session={session} />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
