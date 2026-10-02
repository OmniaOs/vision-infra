import { Link2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { FormField } from '@/shared/components/form-field'
import { buildSpace, SPACE_KIND_LABEL, SPACE_NAME_PATTERN, type SpaceKind } from '@/shared/domain/space-metadata'
import { toast } from '@/shared/toast/toast'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useAssignNamespace, useSpaceCatalog } from '../hooks/use-space-queries'
import type { NamespaceRow } from '../types/space-types'

const NEW_SPACE = '__new__'
const KINDS: SpaceKind[] = ['project', 'internal', 'client']

interface AssignNamespaceDialogProps {
  row: NamespaceRow | null
  onClose: () => void
}

/** Decide a que espacio pertenece un namespace antiguo: uno que ya existe o uno nuevo (con su prefijo). */
export function AssignNamespaceDialog({ row, onClose }: AssignNamespaceDialogProps) {
  const { data: catalog = [] } = useSpaceCatalog(row !== null)
  const { mutate, isPending, isError, error, reset } = useAssignNamespace()
  const [choice, setChoice] = useState<string>('')
  const [kind, setKind] = useState<SpaceKind>('project')
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string>()

  useEffect(() => {
    setChoice(row?.space ?? '')
    setName('')
    setFormError(undefined)
    reset()
  }, [row, reset])

  const options = catalog.filter((space) => space.id !== 'global')
  const target = choice === NEW_SPACE ? buildSpace(kind, name.trim().toLowerCase()) : choice

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!row) return
    if (choice === NEW_SPACE && !SPACE_NAME_PATTERN.test(name.trim().toLowerCase())) return setFormError('Usa minúsculas, números y guiones. Ejemplo: omniapos')
    if (!choice) return setFormError('Elige un espacio.')
    setFormError(undefined)
    mutate(
      { namespace: row.namespace, space: target },
      {
        onSuccess: () => {
          toast.success('Asignado', `${row.namespace} ahora es ${target}. Se aplica al instante.`)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar «{row?.namespace}» a un espacio</DialogTitle>
          <DialogDescription>
            Sus {row?.count} memorias no se mueven ni se reescriben: el espacio solo decide quién las ve. Las personas con ese espacio las verán al instante.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <FormField label="Espacio" htmlFor="assign-space" error={formError ?? (isError ? describeApiError(error) : undefined)}>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="assign-space">
                <SelectValue placeholder="Elige un espacio existente" />
              </SelectTrigger>
              <SelectContent>
                {options.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.id} · {space.memories} memorias{space.hasNotes ? ' · con notas' : ''}
                  </SelectItem>
                ))}
                {options.length > 0 ? <SelectSeparator /> : null}
                <SelectItem value={NEW_SPACE}>Crear un espacio nuevo…</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {choice === NEW_SPACE ? (
            <div className="flex gap-2">
              <Select value={kind} onValueChange={(next) => setKind(next as SpaceKind)}>
                <SelectTrigger className="w-40 shrink-0" aria-label="Tipo de espacio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {SPACE_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="nombre" aria-label="Nombre del espacio" autoCapitalize="none" spellCheck={false} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <AnimatedButton type="submit" isLoading={isPending}>
              <Link2 /> Asignar
            </AnimatedButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
