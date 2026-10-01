const formatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "1 oct 2026". Texto vacio si la fecha no existe o no es valida. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : formatter.format(date)
}

/** "1 oct, 18:30". Para caducidades. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(date)
}
