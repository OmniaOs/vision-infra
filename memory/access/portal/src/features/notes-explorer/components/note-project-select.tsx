import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { describeSpace } from '@/shared/domain/space-metadata'
import type { NoteProject } from '../types/note-types'

interface NoteProjectSelectProps {
  projects: NoteProject[]
  value?: string
  onChange: (project: string) => void
}

export function NoteProjectSelect({ projects, value, onChange }: NoteProjectSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64" aria-label="Espacio">
        <SelectValue placeholder="Elige un espacio" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.name} value={project.name}>
            {project.space ? `${project.name} · ${describeSpace(project.space).kindLabel}` : project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
