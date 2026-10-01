import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Une clases de Tailwind resolviendo conflictos (la ultima gana). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
