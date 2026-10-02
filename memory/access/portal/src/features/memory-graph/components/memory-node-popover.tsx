import { motion } from 'framer-motion'
import { Calendar, Check, Copy, Link2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { copyToClipboard } from '@/shared/lib/copy-to-clipboard'
import { formatDateTime } from '@/shared/lib/format-date'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import type { ForceNode, MemoryItem } from '../types/graph-types'
import type { NodeAnchor } from './memory-force-graph'

const CARD_WIDTH = 340
const MARGIN = 12
const GAP = 14

interface MemoryNodePopoverProps {
  node: ForceNode
  anchor: NodeAnchor
  /** Lienzo donde vive la tarjeta (para que no se salga). */
  bounds: { width: number; height: number }
  /** Fijada por un clic: se puede leer completa, copiar y saltar a memorias relacionadas. */
  pinned: boolean
  related: MemoryItem[]
  topicLabel?: string
  onJump: (id: string) => void
  onClose: () => void
  /** Solo para administradores: borra esta memoria (pide confirmacion). */
  onDelete?: () => void
  isDeleting?: boolean
}

/** Tarjeta flotante pegada al nodo: vista previa al pasar el cursor y lectura completa al hacer clic. */
export function MemoryNodePopover({ node, anchor, bounds, pinned, related, topicLabel, onJump, onClose, onDelete, isDeleting = false }: MemoryNodePopoverProps) {
  const [copied, setCopied] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const left = Math.min(Math.max(anchor.x, CARD_WIDTH / 2 + MARGIN), Math.max(bounds.width - CARD_WIDTH / 2 - MARGIN, CARD_WIDTH / 2 + MARGIN))
  // La tarjeta fijada va por donde haya mas sitio y nunca se sale del lienzo: si no cabe, se desplaza por dentro.
  const spaceAbove = anchor.y - anchor.radius - GAP - MARGIN
  const spaceBelow = bounds.height - anchor.y - anchor.radius - GAP - MARGIN
  const below = pinned ? spaceBelow > spaceAbove : anchor.y < 150
  const top = below ? anchor.y + anchor.radius + GAP : anchor.y - anchor.radius - GAP
  const maxHeight = Math.max(160, below ? spaceBelow : spaceAbove)
  const tail = Math.min(Math.max(anchor.x - (left - CARD_WIDTH / 2), 18), CARD_WIDTH - 18)
  const memory = node.memory

  const copy = async () => {
    if (memory && (await copyToClipboard(memory.content))) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <motion.div
      role={pinned ? 'dialog' : 'tooltip'}
      aria-label={memory ? 'Memoria' : `Tema ${node.label}`}
      initial={{ opacity: 0, scale: 0.94, y: below ? -6 : 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{ left, top, width: CARD_WIDTH, maxHeight, overflowY: pinned ? 'auto' : 'hidden', translateX: '-50%', translateY: below ? '0%' : '-100%', transformOrigin: below ? 'top center' : 'bottom center' }}
      onClick={(event) => event.stopPropagation()}
      className={cn('absolute z-20 rounded-2xl border bg-card/95 p-4 text-sm shadow-2xl shadow-black/40 backdrop-blur-md', pinned ? 'pointer-events-auto' : 'pointer-events-none')}
    >
      <span
        aria-hidden
        style={{ left: tail }}
        className={cn('absolute size-3 -translate-x-1/2 rotate-45 border bg-card', below ? '-top-1.5 border-b-0 border-r-0' : '-bottom-1.5 border-l-0 border-t-0')}
      />
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: node.color }} />
          <span className="truncate">{topicLabel ?? node.label}</span>
        </span>
        {pinned ? (
          <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-7" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        ) : null}
      </div>

      {memory ? (
        <>
          <p className={cn('whitespace-pre-wrap break-words leading-6', pinned ? 'max-h-52 overflow-y-auto pr-1' : 'line-clamp-4')}>{memory.content}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {memory.categories.map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
            {memory.createdAt ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="size-3" aria-hidden /> {formatDateTime(memory.createdAt)}
              </span>
            ) : null}
          </div>
          {pinned && related.length > 0 ? (
            <div className="mt-4 space-y-1.5 border-t pt-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Link2 className="size-3" aria-hidden /> Relacionadas
              </p>
              {related.map((item) => (
                <button key={item.id} type="button" onClick={() => onJump(item.id)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent">
                  {item.content}
                </button>
              ))}
            </div>
          ) : null}
          {pinned ? (
            <div className="mt-3 flex items-center justify-end gap-2">
              {onDelete ? (
                confirmingDelete ? (
                  <>
                    <span className="text-xs text-muted-foreground">¿Borrarla?</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
                      No
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting}>
                      {isDeleting ? 'Borrando…' : 'Sí, borrar'}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 /> Borrar
                  </Button>
                )
              ) : null}
              {confirmingDelete ? null : (
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={copy}>
                  {copied ? <Check className="text-success" /> : <Copy />} {copied ? 'Copiada' : 'Copiar'}
                </Button>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-muted-foreground">Clic para fijarla y leerla completa</p>
          )}
        </>
      ) : (
        <p className="font-medium">
          {node.label} <span className="font-normal text-muted-foreground">· {node.topic?.size ?? 0} memorias</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Clic para enfocar solo este tema</span>
        </p>
      )}
    </motion.div>
  )
}
