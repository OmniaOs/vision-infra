import { KeyRound } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { TokenRecord } from '@/shared/types/token-record'

function describeOrigin(token: TokenRecord): string {
  if (token.origin === 'admins') return 'Acceso de emergencia (Coolify)'
  if (token.origin === 'env') return 'Definido en Coolify'
  return token.createdBy ? `Creado por ${token.createdBy}` : 'Creado desde el portal'
}

export function TokenLabelCell({ token }: { token: TokenRecord }) {
  const revoked = Boolean(token.revokedAt)
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', revoked ? 'bg-muted text-muted-foreground' : 'bg-primary/12 text-primary')}>
        <KeyRound className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 leading-tight">
        <p className={cn('truncate font-medium', revoked && 'text-muted-foreground line-through')}>{token.label}</p>
        <p className="truncate text-xs text-muted-foreground">{describeOrigin(token)}</p>
      </div>
    </div>
  )
}
