/** Colores de los temas: medios, para que se lean igual en el tema oscuro y en el claro. */
const TOPIC_COLORS = ['#2dd4bf', '#f59e0b', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#38bdf8', '#e879f9', '#a3e635'] as const

export const UNASSIGNED_TOPIC_ID = 'sin-tema'
export const UNASSIGNED_COLOR = '#94a3b8'

export function topicColor(index: number): string {
  return TOPIC_COLORS[index % TOPIC_COLORS.length]
}
