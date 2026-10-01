import type { NoteSummary, NoteTreeFolder, NoteTreeNode } from '../types/note-types'

/** Convierte la lista plana de notas (con su ruta) en carpetas anidadas: carpetas primero, todo en orden alfabetico. */
export function buildNoteTree(notes: NoteSummary[]): NoteTreeNode[] {
  const root: NoteTreeFolder = { kind: 'folder', name: '', path: '', children: [], noteCount: 0 }
  for (const note of notes) {
    const segments = note.path.split('/').filter(Boolean).slice(0, -1)
    let folder = root
    for (const segment of segments) {
      const path = folder.path ? `${folder.path}/${segment}` : segment
      let next = folder.children.find((child): child is NoteTreeFolder => child.kind === 'folder' && child.name === segment)
      if (!next) {
        next = { kind: 'folder', name: segment, path, children: [], noteCount: 0 }
        folder.children.push(next)
      }
      next.noteCount += 1
      folder = next
    }
    folder.children.push({ kind: 'note', note })
  }
  return sortNodes(root.children)
}

function sortNodes(nodes: NoteTreeNode[]): NoteTreeNode[] {
  const label = (node: NoteTreeNode) => (node.kind === 'folder' ? node.name : node.note.title)
  nodes.sort((a, b) => (a.kind === b.kind ? label(a).localeCompare(label(b), 'es') : a.kind === 'folder' ? -1 : 1))
  for (const node of nodes) if (node.kind === 'folder') sortNodes(node.children)
  return nodes
}

/** Notas cuyo titulo, ruta o tipo contienen el texto. */
export function filterNotes(notes: NoteSummary[], query: string): NoteSummary[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return notes
  return notes.filter((note) => [note.title, note.path, note.noteType].some((text) => text?.toLowerCase().includes(needle)))
}
