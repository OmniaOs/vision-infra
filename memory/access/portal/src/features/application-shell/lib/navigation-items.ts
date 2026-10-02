import { BookOpenText, KeyRound, Layers, Network, UserRound, UsersRound, type LucideIcon } from 'lucide-react'

export interface NavigationItem {
  label: string
  icon: LucideIcon
  /** Ruta de la pagina. Sin ruta = aun no construida. */
  to?: string
  adminOnly?: boolean
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: 'Personas', icon: UsersRound, to: '/people', adminOnly: true },
  { label: 'Espacios', icon: Layers, to: '/spaces', adminOnly: true },
  { label: 'Tokens', icon: KeyRound, to: '/tokens' },
  { label: 'Mi cuenta', icon: UserRound, to: '/account' },
  { label: 'Notas', icon: BookOpenText, to: '/notes' },
  { label: 'Grafo de memoria', icon: Network, to: '/memory-graph' },
]
