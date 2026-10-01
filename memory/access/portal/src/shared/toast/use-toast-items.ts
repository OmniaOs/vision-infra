import { useSyncExternalStore } from 'react'
import { getToastSnapshot, subscribeToToasts } from './toast-store'

export function useToastItems() {
  return useSyncExternalStore(subscribeToToasts, getToastSnapshot, getToastSnapshot)
}
