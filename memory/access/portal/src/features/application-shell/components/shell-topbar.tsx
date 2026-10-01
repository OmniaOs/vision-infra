import type { CurrentSession } from '@/shared/types/current-session'
import { MobileNavigation } from './mobile-navigation'
import { ShellUserMenu } from './shell-user-menu'
import { ThemeToggle } from './theme-toggle'

export function ShellTopbar({ session }: { session: CurrentSession }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-8">
      <MobileNavigation role={session.role} />
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <ShellUserMenu session={session} />
      </div>
    </header>
  )
}
