export interface PasswordRequirement {
  id: string
  label: string
  met: boolean
}

export interface PasswordStrength {
  /** 0 (vacia) a 4 (fuerte). */
  score: 0 | 1 | 2 | 3 | 4
  label: string
  requirements: PasswordRequirement[]
  /** Cumple lo que exige el servidor (12 caracteres, sin el usuario, no repetitiva). */
  acceptable: boolean
}

const LABELS = ['', 'Muy débil', 'Débil', 'Buena', 'Fuerte'] as const

/** Replica las reglas del servidor (auth.mjs: passwordProblem) y agrega una nota de fortaleza orientativa. */
export function evaluatePasswordStrength(password: string, userId = ''): PasswordStrength {
  const long = password.length >= 12
  const notRepetitive = new Set(password).size >= 5
  const withoutUser = !userId || !password.toLowerCase().includes(userId.toLowerCase())
  const requirements: PasswordRequirement[] = [
    { id: 'length', label: 'Al menos 12 caracteres', met: long },
    { id: 'variety', label: 'No es repetitiva', met: notRepetitive && password.length > 0 },
    ...(userId ? [{ id: 'user', label: 'No contiene tu usuario', met: withoutUser && password.length > 0 }] : []),
  ]

  let score = 0
  if (password.length > 0) score = 1
  if (long) score = 2
  if (long && /[a-z]/.test(password) && /[A-Z0-9]/.test(password)) score = 3
  if (password.length >= 16 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)) score = 4
  if (!notRepetitive || !withoutUser) score = Math.min(score, 1)

  const clamped = score as PasswordStrength['score']
  return { score: clamped, label: LABELS[clamped], requirements, acceptable: long && notRepetitive && withoutUser }
}
