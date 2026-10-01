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
    x: 40 + random() * 720,
    y: 40 + random() * 720,
    radius: 3 + random() * 4.5,
    kind: random() < 0.22 ? 'basic-memory' : 'mem0',
    driftX: (random() - 0.5) * 46,
    driftY: (random() - 0.5) * 46,
    duration: 9 + random() * 9,
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
 * Red de nodos que se mueve despacio: teal para Mem0 y ambar para Basic Memory, los mismos colores
 * del diagrama de arquitectura. Cada linea se anima con las mismas claves que sus dos nodos, asi
 * siguen unidos mientras derivan. Con "reducir movimiento" se queda quieta.
 */
export function MemoryConstellation({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const { nodes, edges } = useMemo(() => {
    const generated = buildNodes(34)
    return { nodes: generated, edges: buildEdges(generated, 190) }
  }, [])

  return (
    <svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {edges.map(([a, b]) => (
        <motion.line
          key={`${a.id}-${b.id}`}
          className="stroke-primary"
          strokeWidth={1}
          strokeOpacity={0.22}
          initial={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
          animate={
            reduceMotion
              ? undefined
              : { x1: [a.x, a.x + a.driftX], y1: [a.y, a.y + a.driftY], x2: [b.x, b.x + b.driftX], y2: [b.y, b.y + b.driftY] }
          }
          transition={{
            x1: drift(a), y1: drift(a), x2: drift(b), y2: drift(b),
          }}
        />
      ))}
      {nodes.map((node) => (
        <motion.circle
          key={node.id}
          className={node.kind === 'mem0' ? 'fill-primary' : 'fill-amber'}
          initial={{ cx: node.x, cy: node.y, r: node.radius }}
          animate={reduceMotion ? undefined : { cx: [node.x, node.x + node.driftX], cy: [node.y, node.y + node.driftY], r: [node.radius, node.radius * 1.35] }}
          transition={{ cx: drift(node), cy: drift(node), r: drift(node) }}
        />
      ))}
    </svg>
  )
}
