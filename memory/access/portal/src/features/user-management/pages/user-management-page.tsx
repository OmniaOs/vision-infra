import { UserPlus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { useCurrentSession } from '@/features/authentication/hooks/use-current-session'
import { AnimatedButton } from '@/shared/components/animated-button'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import type { UserRecord } from '@/shared/types/user-record'
import { CreateUserDialog } from '../components/create-user-dialog'
import { CredentialsActionDialog, type CredentialsAction } from '../components/credentials-action-dialog'
import { DeleteUserDialog } from '../components/delete-user-dialog'
import { EditUserDialog } from '../components/edit-user-dialog'
import type { UserAction } from '../components/user-row-actions'
import { UserStatsCards } from '../components/user-stats-cards'
import { UsersTable } from '../components/users-table'
import { useUsers } from '../hooks/use-users'

interface PendingAction {
  action: UserAction
  user: UserRecord
}

export function UserManagementPage() {
  const { data: session } = useCurrentSession()
  const { data: users = [], isLoading, error } = useUsers()
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const handleAction = useCallback((action: UserAction, user: UserRecord) => setPending({ action, user }), [])
  const close = () => setPending(null)
  const credentialsAction: CredentialsAction | null = pending?.action === 'rotate' || pending?.action === 'invite' ? pending.action : null

  return (
    <div className="space-y-8">
      <PageHeader
        title="Personas"
        description="Da de alta empleados y clientes, ajusta lo que ven y reparte sus accesos. Los cambios se aplican al momento."
        actions={
          <AnimatedButton onClick={() => setCreating(true)}>
            <UserPlus /> Dar de alta
          </AnimatedButton>
        }
      />
      <UserStatsCards users={users} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {describeApiError(error)}
        </p>
      ) : null}
      <FadeIn delay={0.2}>
        <UsersTable users={users} isLoading={isLoading} currentUserId={session?.id ?? ''} onAction={handleAction} />
      </FadeIn>
      <CreateUserDialog open={creating} onOpenChange={setCreating} />
      <EditUserDialog user={pending?.action === 'edit' ? pending.user : null} onClose={close} />
      <DeleteUserDialog user={pending?.action === 'delete' ? pending.user : null} onClose={close} />
      <CredentialsActionDialog action={credentialsAction} user={credentialsAction ? pending!.user : null} onClose={close} />
    </div>
  )
}
