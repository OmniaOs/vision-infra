import { describeSpace } from '@/shared/domain/space-metadata'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

interface GraphSpaceSelectProps {
  spaces: string[]
  value?: string
  onChange: (space: string) => void
}

export function GraphSpaceSelect({ spaces, value, onChange }: GraphSpaceSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64" aria-label="Espacio">
        <SelectValue placeholder="Elige un espacio" />
      </SelectTrigger>
      <SelectContent>
        {spaces.map((space) => (
          <SelectItem key={space} value={space}>
            {space} · {describeSpace(space).kindLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
