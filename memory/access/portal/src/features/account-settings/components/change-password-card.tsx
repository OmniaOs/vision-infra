import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { FormField } from '@/shared/components/form-field'
import { PasswordField } from '@/shared/components/password-field'
import { PasswordStrengthMeter } from '@/shared/components/password-strength-meter'
import { evaluatePasswordStrength } from '@/shared/lib/evaluate-password-strength'
import { toast } from '@/shared/toast/toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { useChangePassword } from '../hooks/use-change-password'

export function ChangePasswordCard({ userId }: { userId: string }) {
  const { mutate, isPending, isError, error, reset } = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const mismatch = confirmation.length > 0 && confirmation !== next
  const canSubmit = current.length > 0 && evaluatePasswordStrength(next, userId).acceptable && next === confirmation

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutate(
      { current, next },
      {
        onSuccess: ({ sesiones_cerradas }) => {
          toast.success('Contraseña cambiada', sesiones_cerradas > 0 ? 'Cerramos tus otras sesiones abiertas.' : undefined)
          setCurrent('')
          setNext('')
          setConfirmation('')
          reset()
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseña del portal</CardTitle>
        <CardDescription>Cámbiala cuando quieras. Tus otras sesiones se cierran al hacerlo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-md space-y-5" noValidate>
          <FormField label="Contraseña actual" htmlFor="current-password">
            <PasswordField id="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" />
          </FormField>
          <FormField label="Contraseña nueva" htmlFor="new-password">
            <PasswordField id="new-password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" />
          </FormField>
          <PasswordStrengthMeter password={next} userId={userId} />
          <FormField label="Repite la nueva" htmlFor="new-password-confirmation" error={mismatch ? 'Las contraseñas no coinciden.' : undefined}>
            <PasswordField
              id="new-password-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              aria-invalid={mismatch}
            />
          </FormField>
          {isError ? (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {describeApiError(error)}
            </div>
          ) : null}
          <AnimatedButton type="submit" isLoading={isPending} disabled={!canSubmit}>
            Cambiar contraseña
          </AnimatedButton>
        </form>
      </CardContent>
    </Card>
  )
}
