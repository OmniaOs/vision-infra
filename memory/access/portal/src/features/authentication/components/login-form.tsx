import { motion } from 'framer-motion'
import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { FormField } from '@/shared/components/form-field'
import { PasswordField } from '@/shared/components/password-field'
import { Input } from '@/shared/ui/input'
import { useLogin } from '../hooks/use-login'

export function LoginForm({ initialId = '' }: { initialId?: string }) {
  const navigate = useNavigate()
  const login = useLogin()
  const [id, setId] = useState(initialId)
  const [password, setPassword] = useState('')
  const [attempts, setAttempts] = useState(0)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate(
      { id: id.trim(), password },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: () => setAttempts((n) => n + 1),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <FormField label="Usuario" htmlFor="login-id">
        <Input
          id="login-id"
          value={id}
          onChange={(event) => setId(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus={!initialId}
          placeholder="tu-usuario"
          required
        />
      </FormField>
      <FormField label="Contraseña" htmlFor="login-password">
        <PasswordField
          id="login-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus={Boolean(initialId)}
          placeholder="••••••••••••"
          required
        />
      </FormField>

      {login.isError ? (
        <motion.div
          key={attempts}
          role="alert"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -7, 7, -4, 4, 0] }}
          transition={{ duration: 0.4 }}
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {describeApiError(login.error)}
        </motion.div>
      ) : null}

      <AnimatedButton type="submit" size="lg" className="w-full" isLoading={login.isPending} disabled={!id.trim() || !password}>
        Entrar
      </AnimatedButton>
    </form>
  )
}
