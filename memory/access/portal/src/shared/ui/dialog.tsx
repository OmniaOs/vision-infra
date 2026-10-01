import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react'
import { cn } from '@/shared/lib/cn'
import { springSoft } from '@/shared/motion/motion-presets'

// Radix desmonta el contenido al cerrar y no deja que Framer Motion anime la salida. Para poder
// animarla se guarda aqui el estado "abierto" y se monta el contenido con forceMount dentro de
// AnimatePresence.
const DialogOpenContext = createContext(false)

function Dialog({ open: openProp, defaultOpen = false, onOpenChange, children, ...rest }: DialogPrimitive.DialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = openProp ?? internalOpen
  const handleOpenChange = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }
  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...rest}>
        {children}
      </DialogPrimitive.Root>
    </DialogOpenContext.Provider>
  )
}

const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => {
    const open = useContext(DialogOpenContext)
    return (
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
              <DialogPrimitive.Content forceMount asChild ref={ref} {...props}>
                <motion.div
                  className={cn(
                    'pointer-events-auto relative my-auto grid w-full max-w-lg grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl border bg-card p-6 shadow-2xl',
                    className,
                  )}
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
                  transition={springSoft}
                >
                  {children}
                  <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <X className="size-4" />
                    <span className="sr-only">Cerrar</span>
                  </DialogPrimitive.Close>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    )
  },
)
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 pr-8 text-left', className)} {...props} />
)

const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
)

const DialogTitle = forwardRef<ElementRef<typeof DialogPrimitive.Title>, ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
  ),
)
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = 'DialogDescription'

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger }
