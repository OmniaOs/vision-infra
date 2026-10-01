import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { FormField } from '@/shared/components/form-field'
import type { UserRole } from '@/shared/types/user-role'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { useCreateUser } from '../hooks/use-create-user'
import type { IssuedCredentials } from '@/shared/types/issued-credentials'
import { IssuedCredentialsPanel } from '@/shared/components/issued-credentials-panel'
import { UserPermissionsFields } from './user-permissions-fields'

const USER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const createUser = useCreateUser()
  const [id, setId] = useState('')
  const [permissions, setPermissions] = useState<{ role: UserRole; spaces: string[] }>({ role: 'miembro', spaces: [] })
  const [formError, setFormError] = useState<string>()
  const [issued, setIssued] = useState<IssuedCredentials>()

  const reset = () => {
    setId('')
    setPermissions({ role: 'miembro', spaces: [] })
    setFormError(undefined)
    setIssued(undefined)
    createUser.reset()
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) window.setTimeout(reset, 200)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const cleaned = id.trim().toLowerCase()
    if (!USER_ID_PATTERN.test(cleaned)) return setFormError('2 a 32 caracteres: minúsculas, números, guiones.')
    if (permissions.role === 'cliente' && permissions.spaces.length === 0) return setFormError('Un cliente necesita al menos un espacio cli-…')
    setFormError(undefined)
    createUser.mutate({ id: cleaned, ...permissions }, { onSuccess: setIssued })
  }

  const error = formError ?? (createUser.isError ? describeApiError(createUser.error) : undefined)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{issued ? `${issued.userId} ya tiene acceso` : 'Dar de alta a una persona'}</DialogTitle>
          <DialogDescription>
            {issued ? 'Estas son sus credenciales.' : 'Se genera su token del MCP y un enlace de un solo uso para el portal.'}
          </DialogDescription>
        </DialogHeader>
        {issued ? (
          <>
            <IssuedCredentialsPanel credentials={issued} />
            <DialogFooter>
              <AnimatedButton onClick={() => handleOpenChange(false)}>Listo</AnimatedButton>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <FormField label="Usuario" htmlFor="create-user-id" error={error} hint="Ejemplo: emilio">
              <Input
                id="create-user-id"
                value={id}
                onChange={(event) => setId(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(error)}
                autoFocus
              />
            </FormField>
            <UserPermissionsFields idPrefix="create-user" role={permissions.role} spaces={permissions.spaces} onChange={setPermissions} />
            <DialogFooter>
              <AnimatedButton type="submit" isLoading={createUser.isPending}>
                <UserPlus /> Dar de alta
              </AnimatedButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
