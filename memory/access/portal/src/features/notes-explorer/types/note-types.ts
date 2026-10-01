export interface NoteProject {
  name: string
  /** Espacio al que corresponde, o null si el proyecto aun no usa nombre de espacio (solo lo ve un admin). */
  space: string | null
  access: 'rw' | 'r'
}

export interface NoteSummary {
  title: string
  permalink: string
  /** Ruta del archivo dentro del proyecto, por ejemplo `frutal/incidentes/nota.md`. */
  path: string
  noteType: string | null
  updatedAt: string | null
}

export interface NoteDocument {
  project: string
  title: string
  permalink: string
  path: string
  content: string
  frontmatter: Record<string, unknown>
}

export interface NoteTreeFolder {
  kind: 'folder'
  name: string
  path: string
  children: NoteTreeNode[]
  noteCount: number
}

export interface NoteTreeLeaf {
  kind: 'note'
  note: NoteSummary
}

export type NoteTreeNode = NoteTreeFolder | NoteTreeLeaf
