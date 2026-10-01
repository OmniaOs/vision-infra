import { Ban, CircleCheck, Lock, type LucideIcon } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { TOKEN_STATUS_LABEL, type TokenStatus } from '../lib/token-status'

const STATUS_STYLE: Record<TokenStatus, { variant: 'success' | 'destructive' | 'secondary'; icon: LucideIcon }> = {
  active: { variant: 'success', icon: CircleCheck },
  revoked: { variant: 'destructive', icon: Ban },
  coolify: { variant: 'secondary', icon: Lock },
}

export function TokenStatusBadge({ status }: { status: TokenStatus }) {
  const { variant, icon: Icon } = STATUS_STYLE[status]
  return (
    <Badge variant={variant} className="gap-1.5">
      <Icon className="size-3" aria-hidden />
      {TOKEN_STATUS_LABEL[status]}
    </Badge>
  )
}
