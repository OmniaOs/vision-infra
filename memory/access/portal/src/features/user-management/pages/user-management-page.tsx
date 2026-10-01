import { UserPlus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { describeApiError } from '@/shared/api/describe-api-error'
import { useCurrentSession } from '@/features/authentication/hooks/use-current-session'
import { RevokeAllTokensDialog } from '@/features/token-management/components/revoke-all-tokens-dialog'
import { AnimatedButton } from '@/shared/components/animated-button'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import type { UserRecord } from '@/shared/types/user-record'
import { AdoptUserDialog } from '../components/adopt-user-dialog'
import { CreateUserDialog } from '../components/create-user-dialog'
import { DeleteUserDialog } from '../components/delete-user-dialog'
import { EditUserDialog } from '../components/edit-user-dialog'
import { InviteUserDialog } from '../components/invite-user-dialog'
import type { UserAction } from '../components/user-row-actions'
import { UserStatsCards } from '../components/user-stats-cards'
import { UsersTable } from '../components/users-table'
import { useUsers } from '../hooks/use-users'

interface PendingAction {
  action: UserAction
  user: UserRecord
}

export function UserManagementPage() {
  const navigate = useNavigate()
  const { data: session } = useCurrentSession()
  const { data: users = [], isLoading, error } = useUsers()
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const handleAction = useCallback(
    (action: UserAction, user: UserRecord) => {
      // "Ver sus tokens" no abre un dialogo: lleva a la pagina de tokens ya filtrada por esa persona.
      if (action === 'tokens') return navigate(`/tokens?person=${encodeURIComponent(user.id)}`)
      setPending({ action, user })
    },
    [navigate],
  )
  const close = () => setPending(null)
  const userFor = (action: UserAction) => (pending?.action === action ? pending.user : null)

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
      <EditUserDialog user={userFor('edit')} onClose={close} />
      <InviteUserDialog user={userFor('invite')} onClose={close} />
      <AdoptUserDialog user={userFor('adopt')} onClose={close} />
      <RevokeAllTokensDialog user={userFor('revoke-tokens')} onClose={close} />
      <DeleteUserDialog user={userFor('delete')} onClose={close} />
    </div>
  )
}
