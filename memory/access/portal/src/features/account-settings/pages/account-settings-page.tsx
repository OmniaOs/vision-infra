import { useCurrentSession } from '@/features/authentication/hooks/use-current-session'
import { PageHeader } from '@/shared/components/page-header'
import { StaggerGroup } from '@/shared/motion/stagger-group'
import { StaggerItem } from '@/shared/motion/stagger-item'
import { ChangePasswordCard } from '../components/change-password-card'
import { RotateOwnTokenCard } from '../components/rotate-own-token-card'
import { SessionSummaryCard } from '../components/session-summary-card'

export function AccountSettingsPage() {
  const { data: session } = useCurrentSession()
  if (!session) return null
  return (
    <div className="space-y-8">
      <PageHeader title="Mi cuenta" description="Tu acceso a la memoria compartida: contraseña del portal y token del MCP." />
      <StaggerGroup className="grid gap-6 xl:grid-cols-2" stagger={0.08} delay={0.1}>
        <StaggerItem className="xl:col-span-2">
          <SessionSummaryCard session={session} />
        </StaggerItem>
        <StaggerItem>
          <ChangePasswordCard userId={session.id} />
        </StaggerItem>
        <StaggerItem>
          <RotateOwnTokenCard userId={session.id} canRotate={session.portal} />
        </StaggerItem>
      </StaggerGroup>
    </div>
  )
}
