import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import type { ForceNode } from '../types/graph-types'

interface GraphTopicLegendProps {
  topics: ForceNode[]
  focusTopicId?: string
  onFocus: (topicId: string | undefined) => void
}

/** Los temas como etiquetas: un clic enfoca ese tema en el grafo y atenua el resto. */
export function GraphTopicLegend({ topics, focusTopicId, onFocus }: GraphTopicLegendProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Temas">
      {topics.map((topic, index) => {
        const active = topic.topicId === focusTopicId
        return (
          <motion.button
            key={topic.id}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onFocus(active ? undefined : topic.topicId)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              active ? 'border-transparent text-background' : 'bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
            style={active ? { backgroundColor: topic.color } : undefined}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: active ? 'currentColor' : topic.color }} />
            {topic.label}
            <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-muted-foreground/70')}>{topic.topic?.size}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
