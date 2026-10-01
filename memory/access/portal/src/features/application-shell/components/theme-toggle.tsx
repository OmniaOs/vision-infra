import { AnimatePresence, motion } from 'framer-motion'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/shared/theme/use-theme'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar tema">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={resolved}
              initial={{ rotate: -80, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 80, scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="inline-flex"
            >
              {resolved === 'dark' ? <Moon /> : <Sun />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuCheckboxItem key={value} checked={preference === value} onCheckedChange={() => setPreference(value)}>
            <Icon className="mr-2 size-4" />
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
