import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { describeApiError } from '@/shared/api/describe-api-error'
import { useCurrentSession } from '@/features/authentication/hooks/use-current-session'
import { AnimatedButton } from '@/shared/components/animated-button'
import { PageHeader } from '@/shared/components/page-header'
import { FadeIn } from '@/shared/motion/fade-in'
import type { TokenRecord } from '@/shared/types/token-record'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { CreateTokenDialog } from '../components/create-token-dialog'
import { RevokeTokenDialog } from '../components/revoke-token-dialog'
import { TokenStatsCards } from '../components/token-stats-cards'
import { TokensTable } from '../components/tokens-table'
import { useAllTokens } from '../hooks/use-all-tokens'
import { useMyTokens } from '../hooks/use-my-tokens'
import type { TokenScope } from '../types/token-scope'

export function TokenManagementPage() {
  const { data: session } = useCurrentSession()
  const isAdmin = session?.role === 'admin'
  const [params] = useSearchParams()
  const person = params.get('person') ?? undefined
  const [scope, setScope] = useState<TokenScope>(isAdmin && person ? 'admin' : 'mine')
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<TokenRecord | null>(null)

  const mine = useMyTokens()
  const all = useAllTokens(Boolean(isAdmin))
  const current = scope === 'admin' ? all : mine
  const tokens = current.data ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tokens"
        description="Cada token es una llave de un equipo o editor hacia la memoria. Mira cuándo y desde dónde se usó por última vez, y revoca el que sobre."
        actions={
          <AnimatedButton onClick={() => setCreating(true)}>
            <Plus /> Nuevo token
          </AnimatedButton>
        }
      />
      {isAdmin ? (
        <Tabs value={scope} onValueChange={(next) => setScope(next as TokenScope)}>
          <TabsList>
            <TabsTrigger value="mine">Mis tokens</TabsTrigger>
            <TabsTrigger value="admin">Todas las personas</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}
      <TokenStatsCards tokens={tokens} />
      {current.error ? (
        <p className="text-sm text-destructive" role="alert">
          {describeApiError(current.error)}
        </p>
      ) : null}
      <FadeIn delay={0.2}>
        <TokensTable key={scope} tokens={tokens} isLoading={current.isLoading} scope={scope} onRevoke={setRevoking} initialSearch={scope === 'admin' ? person : undefined} />
      </FadeIn>
      {session ? <CreateTokenDialog open={creating} onOpenChange={setCreating} scope={scope} currentUserId={session.id} /> : null}
      <RevokeTokenDialog token={revoking} scope={scope} onClose={() => setRevoking(null)} />
    </div>
  )
}
