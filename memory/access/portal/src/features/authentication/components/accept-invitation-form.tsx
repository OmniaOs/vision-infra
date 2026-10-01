import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { FormField } from '@/shared/components/form-field'
import { PasswordField } from '@/shared/components/password-field'
import { PasswordStrengthMeter } from '@/shared/components/password-strength-meter'
import { evaluatePasswordStrength } from '@/shared/lib/evaluate-password-strength'
import { toast } from '@/shared/toast/toast'
import { useAcceptInvitation } from '../hooks/use-accept-invitation'

export function AcceptInvitationForm({ invitationToken }: { invitationToken: string }) {
  const navigate = useNavigate()
  const acceptInvitation = useAcceptInvitation()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const strength = evaluatePasswordStrength(password)
  const mismatch = confirmation.length > 0 && confirmation !== password
  const canSubmit = strength.acceptable && password === confirmation

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    acceptInvitation.mutate(
      { token: invitationToken, password },
      {
        onSuccess: ({ id }) => {
          toast.success('Contraseña creada', 'Ya puedes entrar con tu usuario y tu contraseña.')
          navigate('/sign-in', { replace: true, state: { invitedAs: id } })
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <FormField label="Elige tu contraseña" htmlFor="invitation-password">
        <PasswordField
          id="invitation-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          autoFocus
          required
        />
      </FormField>
      <PasswordStrengthMeter password={password} />
      <FormField label="Repítela" htmlFor="invitation-confirmation" error={mismatch ? 'Las contraseñas no coinciden.' : undefined}>
        <PasswordField
          id="invitation-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          aria-invalid={mismatch}
          required
        />
      </FormField>

      {acceptInvitation.isError ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {describeApiError(acceptInvitation.error)}
        </div>
      ) : null}

      <AnimatedButton type="submit" size="lg" className="w-full" isLoading={acceptInvitation.isPending} disabled={!canSubmit}>
        Crear contraseña
      </AnimatedButton>
    </form>
  )
}
