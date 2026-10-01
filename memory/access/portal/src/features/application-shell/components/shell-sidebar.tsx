import { BrandLogo } from '@/shared/components/brand-logo'
import { StaggerGroup } from '@/shared/motion/stagger-group'
import { StaggerItem } from '@/shared/motion/stagger-item'
import { Separator } from '@/shared/ui/separator'
import type { UserRole } from '@/shared/types/user-role'
import { NAVIGATION_ITEMS } from '../lib/navigation-items'
import { ShellSidebarItem } from './shell-sidebar-item'

export function ShellSidebar({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const items = NAVIGATION_ITEMS.filter((item) => !item.adminOnly || role === 'admin')
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-2">
        <BrandLogo />
      </div>
      <Separator />
      <nav aria-label="Principal">
        <StaggerGroup className="space-y-1" stagger={0.05} delay={0.1}>
          {items.map((item) => (
            <StaggerItem key={item.label}>
              <ShellSidebarItem item={item} onNavigate={onNavigate} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </nav>
      <p className="mt-auto px-2 text-xs leading-relaxed text-muted-foreground">
        Mem0 guarda lecciones cortas y Basic Memory notas largas. Un solo acceso para las dos.
      </p>
    </div>
  )
}
