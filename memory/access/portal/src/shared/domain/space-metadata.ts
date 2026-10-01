export type SpaceKind = 'project' | 'internal' | 'client'

export interface SpaceDescriptor {
  kind: SpaceKind
  name: string
  kindLabel: string
}

/** Prefijos de los espacios del servidor (memory/PERMISOS.md): proy-, int- y cli-. */
export const SPACE_PREFIX: Record<SpaceKind, string> = { project: 'proy-', internal: 'int-', client: 'cli-' }

export const SPACE_KIND_LABEL: Record<SpaceKind, string> = { project: 'Proyecto', internal: 'Interno', client: 'Cliente' }

export const SPACE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function describeSpace(space: string): SpaceDescriptor {
  for (const kind of Object.keys(SPACE_PREFIX) as SpaceKind[]) {
    if (space.startsWith(SPACE_PREFIX[kind])) return { kind, name: space.slice(SPACE_PREFIX[kind].length), kindLabel: SPACE_KIND_LABEL[kind] }
  }
  return { kind: 'project', name: space, kindLabel: SPACE_KIND_LABEL.project }
}

export function buildSpace(kind: SpaceKind, name: string): string {
  return `${SPACE_PREFIX[kind]}${name}`
}
