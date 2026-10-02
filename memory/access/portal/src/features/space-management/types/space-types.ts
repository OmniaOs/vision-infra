/** Un espacio que ya existe en algun sitio (memorias, notas, alias o personas). */
export interface SpaceCatalogEntry {
  id: string
  memories: number
  hasNotes: boolean
}

/** Un namespace de Mem0 con sus memorias y el espacio al que corresponde (null = sin asignar). */
export interface NamespaceRow {
  namespace: string
  count: number
  space: string | null
  /** Tiene un alias (la asignacion se puede cambiar o quitar). */
  aliased: boolean
  /** `env` viene de Coolify y no se edita aqui; `file` se gestiona desde el portal. */
  origin: 'env' | 'file' | null
}
