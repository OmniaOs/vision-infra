/** Iniciales para el avatar a partir de un usuario como `luis.m` o `ana-perez`. */
export function getInitials(userId: string): string {
  const parts = userId.split(/[._-]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : userId.slice(0, 2)
  return letters.toUpperCase()
}
