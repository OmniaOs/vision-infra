import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { FormField } from '@/shared/components/form-field'
import { IssuedCredentialsPanel } from '@/shared/components/issued-credentials-panel'
import type { IssuedCredentials } from '@/shared/types/issued-credentials'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useUsers } from '@/features/user-management/hooks/use-users'
import { useCreateToken } from '../hooks/use-create-token'
import type { TokenScope } from '../types/token-scope'

interface CreateTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: TokenScope
  /** Persona dueña del token. En `mine` es quien tiene la sesion. */
  currentUserId: string
}

export function CreateTokenDialog({ open, onOpenChange, scope, currentUserId }: CreateTokenDialogProps) {
  const createToken = useCreateToken()
  const { data: people = [] } = useUsers(scope === 'admin' && open)
  const [label, setLabel] = useState('')
  const [userId, setUserId] = useState(currentUserId)
  const [formError, setFormError] = useState<string>()
  const [issued, setIssued] = useState<IssuedCredentials>()

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (next) return
    window.setTimeout(() => {
      setLabel('')
      setUserId(currentUserId)
      setFormError(undefined)
      setIssued(undefined)
      createToken.reset()
    }, 200)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const cleaned = label.trim()
    if (!cleaned) return setFormError('Ponle un nombre para reconocerlo, por ejemplo «Laptop de casa».')
    if (cleaned.length > 40) return setFormError('Máximo 40 caracteres.')
    setFormError(undefined)
    createToken.mutate({ scope, userId, label: cleaned }, { onSuccess: setIssued })
  }

  const error = formError ?? (createToken.isError ? describeApiError(createToken.error) : undefined)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{issued ? 'Token creado' : 'Nuevo token'}</DialogTitle>
          <DialogDescription>
            {issued ? 'Conecta el editor con el comando de abajo.' : 'Un token por equipo o editor: así puedes revocar uno sin afectar a los demás.'}
          </DialogDescription>
        </DialogHeader>
        {issued ? (
          <>
            <IssuedCredentialsPanel credentials={issued} forSelf={issued.userId === currentUserId} />
            <DialogFooter>
              <AnimatedButton onClick={() => handleOpenChange(false)}>Listo</AnimatedButton>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {scope === 'admin' ? (
              <FormField label="Persona" htmlFor="create-token-user">
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger id="create-token-user">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([currentUserId, ...people.map((person) => person.id)])].map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
            <FormField label="Nombre" htmlFor="create-token-label" error={error} hint="Ejemplo: Laptop de casa, Claude Code en la oficina">
              <Input id="create-token-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} autoComplete="off" aria-invalid={Boolean(error)} autoFocus />
            </FormField>
            <DialogFooter>
              <AnimatedButton type="submit" isLoading={createToken.isPending}>
                <KeyRound /> Crear token
              </AnimatedButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
