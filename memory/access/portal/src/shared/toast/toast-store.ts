export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  kind: ToastKind
  title: string
  description?: string
}

let items: ToastItem[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToastSnapshot(): ToastItem[] {
  return items
}

export function dismissToast(id: string): void {
  items = items.filter((item) => item.id !== id)
  emit()
}

export function pushToast(toast: Omit<ToastItem, 'id'>, durationMs = 5000): string {
  const id = crypto.randomUUID()
  items = [...items.slice(-3), { ...toast, id }]
  emit()
  window.setTimeout(() => dismissToast(id), durationMs)
  return id
}
