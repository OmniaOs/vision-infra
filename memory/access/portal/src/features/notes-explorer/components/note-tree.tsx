import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Skeleton } from '@/shared/ui/skeleton'
import { Input } from '@/shared/ui/input'
import { buildNoteTree, filterNotes } from '../lib/build-note-tree'
import type { NoteSummary } from '../types/note-types'
import { NoteTreeNodeView } from './note-tree-node'

interface NoteTreeProps {
  notes: NoteSummary[] | undefined
  isLoading: boolean
  selectedPermalink?: string
  onSelect: (permalink: string) => void
}

export function NoteTree({ notes, isLoading, selectedPermalink, onSelect }: NoteTreeProps) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => filterNotes(notes ?? [], query), [notes, query])
  const tree = useMemo(() => buildNoteTree(visible), [visible])

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nota" aria-label="Buscar nota" className="h-9 pl-9" />
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)
        ) : tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{query ? 'Ninguna nota coincide.' : 'Este espacio aún no tiene notas.'}</p>
        ) : (
          tree.map((node) => (
            <NoteTreeNodeView
              key={node.kind === 'folder' ? `d:${node.path}` : `n:${node.note.permalink}`}
              node={node}
              depth={0}
              selectedPermalink={selectedPermalink}
              onSelect={onSelect}
              forceOpen={Boolean(query.trim())}
            />
          ))
        )}
      </div>
    </div>
  )
}
