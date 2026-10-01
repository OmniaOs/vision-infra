import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { SpaceChip } from '@/shared/components/space-chip'
import { buildSpace, SPACE_KIND_LABEL, SPACE_NAME_PATTERN, type SpaceKind } from '@/shared/domain/space-metadata'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

interface SpacePickerProps {
  value: string[]
  onChange: (spaces: string[]) => void
  allowedKinds: SpaceKind[]
}

/** Agrega espacios con el formato del servidor: tipo + nombre en minusculas con guiones. */
export function SpacePicker({ value, onChange, allowedKinds }: SpacePickerProps) {
  const [kind, setKind] = useState<SpaceKind>(allowedKinds[0])
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const activeKind = allowedKinds.includes(kind) ? kind : allowedKinds[0]

  const add = () => {
    const cleaned = name.trim().toLowerCase()
    if (!SPACE_NAME_PATTERN.test(cleaned)) return setError('Usa minúsculas, números y guiones. Ejemplo: frutal')
    const space = buildSpace(activeKind, cleaned)
    if (value.includes(space)) return setError('Ese espacio ya está asignado.')
    onChange([...value, space])
    setName('')
    setError(undefined)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={activeKind} onValueChange={(next) => setKind(next as SpaceKind)} disabled={allowedKinds.length === 1}>
          <SelectTrigger className="w-36 shrink-0" aria-label="Tipo de espacio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedKinds.map((allowed) => (
              <SelectItem key={allowed} value={allowed}>
                {SPACE_KIND_LABEL[allowed]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError(undefined)
          }}
          onKeyDown={handleKeyDown}
          placeholder="nombre-del-espacio"
          aria-label="Nombre del espacio"
          aria-invalid={Boolean(error)}
          autoCapitalize="none"
          spellCheck={false}
        />
        <Button type="button" variant="secondary" size="icon" className="shrink-0" onClick={add} aria-label="Agregar espacio">
          <Plus />
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden text-sm text-destructive" role="alert">
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div className="flex min-h-7 flex-wrap gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {value.map((space) => (
            <motion.span key={space} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.16 }}>
              <SpaceChip space={space} onRemove={() => onChange(value.filter((item) => item !== space))} />
            </motion.span>
          ))}
        </AnimatePresence>
        {value.length === 0 ? <span className="text-sm text-muted-foreground">Sin espacios asignados todavía.</span> : null}
      </div>
    </div>
  )
}
