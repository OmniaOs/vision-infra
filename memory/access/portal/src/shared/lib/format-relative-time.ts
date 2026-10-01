import { formatDate } from './format-date'

const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
]

/** "hace 5 minutos", "ayer". Pasado un mes cae a la fecha. Texto vacio si no hay fecha. */
export function formatRelativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '—'
  const time = Date.parse(value)
  if (Number.isNaN(time)) return '—'
  let amount = Math.round((time - now) / 1000)
  for (const [unit, size] of STEPS) {
    if (Math.abs(amount) < size) return formatter.format(amount, unit)
    amount = Math.round(amount / size)
  }
  return formatDate(value)
}
