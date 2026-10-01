import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { formatDateTime } from '@/shared/lib/format-date'
import { formatRelativeTime } from '@/shared/lib/format-relative-time'
import type { TokenRecord } from '@/shared/types/token-record'

/** "hace 5 minutos" y, debajo, desde donde: IP y cliente. */
export function TokenLastUseCell({ token }: { token: TokenRecord }) {
  if (!token.lastUsedAt) return <span className="text-sm text-muted-foreground">Nunca usado</span>
  const where = [token.lastIp, token.lastDevice].filter(Boolean).join(' · ')
  return (
    <div className="min-w-0 leading-tight">
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="w-fit cursor-default text-sm">{formatRelativeTime(token.lastUsedAt)}</p>
        </TooltipTrigger>
        <TooltipContent>{formatDateTime(token.lastUsedAt)}</TooltipContent>
      </Tooltip>
      {where ? <p className="max-w-[16rem] truncate font-mono text-xs text-muted-foreground" title={where}>{where}</p> : null}
    </div>
  )
}
