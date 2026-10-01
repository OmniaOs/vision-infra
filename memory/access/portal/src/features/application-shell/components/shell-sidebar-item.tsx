import { motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { springSnappy } from '@/shared/motion/motion-presets'
import { Badge } from '@/shared/ui/badge'
import type { NavigationItem } from '../lib/navigation-items'

/** Un destino de la barra lateral. El indicador activo se desliza de uno a otro (layoutId). */
export function ShellSidebarItem({ item, onNavigate }: { item: NavigationItem; onNavigate?: () => void }) {
  const Icon = item.icon

  if (!item.to) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/60" aria-disabled>
        <Icon className="size-[18px]" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <Badge variant="outline" className="px-2 py-0 text-[10px] font-medium">
          Pronto
        </Badge>
      </div>
    )
  }

  return (
    <NavLink to={item.to} onClick={onNavigate} className="relative block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {({ isActive }) => (
        <>
          {isActive ? <motion.span layoutId="sidebar-active-indicator" className="absolute inset-0 rounded-xl bg-accent" transition={springSnappy} /> : null}
          <span className={cn('relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="size-[18px]" aria-hidden />
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  )
}
