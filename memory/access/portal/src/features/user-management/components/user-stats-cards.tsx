import { Crown, Handshake, UsersRound, UserRoundCheck } from 'lucide-react'
import { StatCard } from '@/shared/components/stat-card'
import { StaggerGroup } from '@/shared/motion/stagger-group'
import type { UserRecord } from '@/shared/types/user-record'

export function UserStatsCards({ users }: { users: UserRecord[] }) {
  const admins = users.filter((user) => user.role === 'admin').length
  const clients = users.filter((user) => user.role === 'cliente').length
  const withPortal = users.filter((user) => user.portal).length
  return (
    <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.08} delay={0.1}>
      <StatCard label="Personas" value={users.length} icon={UsersRound} hint="Con acceso a la memoria" />
      <StatCard label="Administradores" value={admins} icon={Crown} tone="primary" />
      <StatCard label="Clientes" value={clients} icon={Handshake} tone="amber" hint="Solo ven su propio espacio" />
      <StatCard label="Con acceso al portal" value={withPortal} icon={UserRoundCheck} tone="success" hint={`${users.length - withPortal} pendientes de invitación`} />
    </StaggerGroup>
  )
}
