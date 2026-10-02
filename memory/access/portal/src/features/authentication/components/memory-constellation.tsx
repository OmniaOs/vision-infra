import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

interface ConstellationNode {
  id: number
  x: number
  y: number
  radius: number
  kind: 'mem0' | 'basic-memory'
  driftX: number
  driftY: number
  duration: number
  delay: number
}

/** Generador pseudoaleatorio con semilla: la figura es la misma en cada visita. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildNodes(count: number): ConstellationNode[] {
  const random = seededRandom(20261001)
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: 30 + random() * 1140,
    y: 30 + random() * 740,
    radius: 2.5 + random() * 4,
    kind: random() < 0.22 ? 'basic-memory' : 'mem0',
    driftX: (random() - 0.5) * 60,
    driftY: (random() - 0.5) * 60,
    duration: 8 + random() * 9,
    delay: random() * 4,
  }))
}

function buildEdges(nodes: ConstellationNode[], maxDistance: number): Array<[ConstellationNode, ConstellationNode]> {
  const edges: Array<[ConstellationNode, ConstellationNode]> = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < maxDistance) edges.push([nodes[i], nodes[j]])
    }
  }
  return edges
}

const drift = (node: ConstellationNode) => ({ duration: node.duration, delay: node.delay, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const })

/**
 * Fondo de pantalla completa: una red de nodos que deriva despacio (teal = Mem0, ambar = Basic Memory), con pulsos
 * de luz que viajan por algunos enlaces, como informacion que circula. Con "reducir movimiento" se queda quieta.
 */
export function MemoryConstellation({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const { nodes, edges, pulses } = useMemo(() => {
    const generated = buildNodes(58)
    const built = buildEdges(generated, 210)
    const random = seededRandom(7)
    const chosen = built.filter(() => random() < 0.2).slice(0, 12)
    return { nodes: generated, edges: built, pulses: chosen.map(([a, b], index) => ({ a, b, delay: index * 0.9, duration: 3.2 + random() * 2.5 })) }
  }, [])

  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {edges.map(([a, b]) => (
        <motion.line
          key={`${a.id}-${b.id}`}
          className="stroke-primary"
          strokeWidth={1}
          strokeOpacity={0.2}
          initial={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
          animate={reduceMotion ? undefined : { x1: [a.x, a.x + a.driftX], y1: [a.y, a.y + a.driftY], x2: [b.x, b.x + b.driftX], y2: [b.y, b.y + b.driftY] }}
          transition={{ x1: drift(a), y1: drift(a), x2: drift(b), y2: drift(b) }}
        />
      ))}
      {reduceMotion
        ? null
        : pulses.map(({ a, b, delay, duration }) => (
            <motion.circle
              key={`pulse-${a.id}-${b.id}`}
              r={2.6}
              className="fill-foreground"
              style={{ filter: 'drop-shadow(0 0 5px hsl(var(--primary)))' }}
              initial={{ cx: a.x, cy: a.y, opacity: 0 }}
              animate={{ cx: [a.x, b.x], cy: [a.y, b.y], opacity: [0, 0.95, 0.95, 0] }}
              transition={{ duration, delay, repeat: Infinity, repeatDelay: 1.5 + (a.id % 4), ease: 'easeInOut' }}
            />
          ))}
      {nodes.map((node) => (
        <motion.circle
          key={node.id}
          className={node.kind === 'mem0' ? 'fill-primary' : 'fill-amber'}
          initial={{ cx: node.x, cy: node.y, r: node.radius, opacity: 0.85 }}
          animate={
            reduceMotion
              ? undefined
              : { cx: [node.x, node.x + node.driftX], cy: [node.y, node.y + node.driftY], r: [node.radius, node.radius * 1.4], opacity: [0.6, 1] }
          }
          transition={{ cx: drift(node), cy: drift(node), r: drift(node), opacity: drift(node) }}
        />
      ))}
    </svg>
  )
}
