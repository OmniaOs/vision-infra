import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import type { NoteTreeNode } from '../types/note-types'

interface NoteTreeNodeViewProps {
  node: NoteTreeNode
  depth: number
  selectedPermalink?: string
  onSelect: (permalink: string) => void
  /** Con una busqueda activa todo se muestra desplegado. */
  forceOpen: boolean
}

const indent = (depth: number) => ({ paddingLeft: `${depth * 14 + 8}px` })

export function NoteTreeNodeView({ node, depth, selectedPermalink, onSelect, forceOpen }: NoteTreeNodeViewProps) {
  const [open, setOpen] = useState(depth === 0)

  if (node.kind === 'note') {
    const selected = node.note.permalink === selectedPermalink
    return (
      <button
        type="button"
        onClick={() => onSelect(node.note.permalink)}
        style={indent(depth)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition-colors',
          selected ? 'bg-amber/15 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <FileText className={cn('size-4 shrink-0', selected && 'text-amber')} aria-hidden />
        <span className="truncate">{node.note.title}</span>
      </button>
    )
  }

  const expanded = open || forceOpen
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={indent(depth)}
        className="flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm font-medium transition-colors hover:bg-accent"
        aria-expanded={expanded}
      >
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }} className="inline-flex">
          <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
        </motion.span>
        {expanded ? <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden /> : <Folder className="size-4 shrink-0 text-primary" aria-hidden />}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{node.noteCount}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            {node.children.map((child) => (
              <NoteTreeNodeView
                key={child.kind === 'folder' ? `d:${child.path}` : `n:${child.note.permalink}`}
                node={child}
                depth={depth + 1}
                selectedPermalink={selectedPermalink}
                onSelect={onSelect}
                forceOpen={forceOpen}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
