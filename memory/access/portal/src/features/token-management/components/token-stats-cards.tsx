import { Ban, CircleCheck, Clock3, MoonStar } from 'lucide-react'
import { StatCard } from '@/shared/components/stat-card'
import { StaggerGroup } from '@/shared/motion/stagger-group'
import type { TokenRecord } from '@/shared/types/token-record'

const DAY_MS = 24 * 3600 * 1000

export function TokenStatsCards({ tokens }: { tokens: TokenRecord[] }) {
  const active = tokens.filter((token) => !token.revokedAt)
  const revoked = tokens.length - active.length
  const usedToday = active.filter((token) => token.lastUsedAt && Date.now() - Date.parse(token.lastUsedAt) < DAY_MS).length
  const neverUsed = active.filter((token) => !token.lastUsedAt).length
  return (
    <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.08} delay={0.1}>
      <StatCard label="Activos" value={active.length} icon={CircleCheck} tone="success" hint="Pueden conectarse ahora" />
      <StatCard label="Usados en 24 h" value={usedToday} icon={Clock3} tone="primary" />
      <StatCard label="Sin usar nunca" value={neverUsed} icon={MoonStar} tone="amber" hint="Revísalos y quita los que sobren" />
      <StatCard label="Revocados" value={revoked} icon={Ban} tone="muted" hint="Historial de 90 días" />
    </StaggerGroup>
  )
}
