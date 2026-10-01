import { AnimatePresence } from 'framer-motion'
import { ToastCard } from './toast-card'
import { useToastItems } from './use-toast-items'

/** Zona fija donde aparecen los avisos. Se monta una sola vez, en los providers. */
export function Toaster() {
  const items = useToastItems()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-end gap-2 p-4 sm:p-6" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => (
          <ToastCard key={item.id} toast={item} />
        ))}
      </AnimatePresence>
    </div>
  )
}
