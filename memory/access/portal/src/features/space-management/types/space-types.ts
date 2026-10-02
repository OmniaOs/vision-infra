/** Un espacio que ya existe en algun sitio (memorias, notas, alias o personas). */
export interface SpaceCatalogEntry {
  id: string
  memories: number
  hasNotes: boolean
}

/** `mem0`: namespaces de las memorias cortas. `kb`: proyectos de Basic Memory (las notas). */
export type AliasKind = 'mem0' | 'kb'

/** Un namespace de Mem0 o un proyecto de Basic Memory y el espacio al que corresponde (null = sin asignar). */
export interface NamespaceRow {
  namespace: string
  /** Memorias que tiene; null en los proyectos de Basic Memory (no se cuentan). */
  count: number | null
  space: string | null
  /** Tiene un alias (la asignacion se puede cambiar o quitar). */
  aliased: boolean
  /** `env` viene de Coolify y no se edita aqui; `file` se gestiona desde el portal. */
  origin: 'env' | 'file' | null
}

export interface WouldDenyEntry {
  t: string
  dev: string
  route: string
  reason: string
}

export interface AccessSettings {
  /** Quien guarda las memorias cortas: el servicio propio del gateway o el contenedor OpenMemory (antiguo). */
  memoryBackend: 'native' | 'openmemory'
  /** Los permisos bloquean (true) o solo registran lo que bloquearian (false). */
  enforce: boolean
  /** Lo fuerza Coolify (ACCESS_ENFORCE=1): no se puede apagar desde el portal. */
  enforcedByEnv: boolean
  wouldDeny: { total: number; since: string; recent: WouldDenyEntry[] }
}
