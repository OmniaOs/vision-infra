import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { formatDateTime } from '@/shared/lib/format-date'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import type { MemoryItem } from '../types/graph-types'

/** Texto completo de la memoria elegida. React escapa el contenido: nunca se interpreta como HTML. */
export function MemoryDetailPanel({ memory }: { memory?: MemoryItem }) {
  return (
    <Card className="min-h-40 p-5">
      <AnimatePresence mode="wait" initial={false}>
        {memory ? (
          <motion.div key={memory.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-3">
            <p className="whitespace-pre-wrap break-words leading-7">{memory.content}</p>
            <div className="flex flex-wrap items-center gap-2">
              {memory.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground">
                {[memory.app, memory.createdAt ? formatDateTime(memory.createdAt) : null].filter(Boolean).join(' · ')}
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-28 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Toca un punto del grafo para leer la memoria completa.
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
