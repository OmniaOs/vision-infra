import { pushToast } from './toast-store'

/** Uso: toast.success('Guardado', 'Los cambios ya estan aplicados'). */
export const toast = {
  success: (title: string, description?: string) => pushToast({ kind: 'success', title, description }),
  error: (title: string, description?: string) => pushToast({ kind: 'error', title, description }, 7000),
  info: (title: string, description?: string) => pushToast({ kind: 'info', title, description }),
}
