import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import type { GraphSpace } from '../types/graph-types'

interface GraphSpaceSelectProps {
  spaces: GraphSpace[]
  value?: string
  onChange: (space: string) => void
}

const describe = (space: GraphSpace) => `${space.label} · ${space.count} ${space.count === 1 ? 'memoria' : 'memorias'}${space.mapped ? '' : ' · sin espacio'}`

/** Cada espacio con cuantas memorias tiene; los namespaces antiguos (solo admin) se marcan "sin espacio". */
export function GraphSpaceSelect({ spaces, value, onChange }: GraphSpaceSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-80" aria-label="Espacio">
        <SelectValue placeholder="Elige un espacio" />
      </SelectTrigger>
      <SelectContent>
        {spaces.map((space) => (
          <SelectItem key={space.id} value={space.id}>
            {describe(space)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
