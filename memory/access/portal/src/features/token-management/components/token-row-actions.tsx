import { Ban } from 'lucide-react'
import type { TokenRecord } from '@/shared/types/token-record'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

interface TokenRowActionsProps {
  token: TokenRecord
  onRevoke: (token: TokenRecord) => void
}

export function TokenRowActions({ token, onRevoke }: TokenRowActionsProps) {
  if (token.revokedAt) return null
  if (!token.managed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default text-xs text-muted-foreground">Coolify</span>
        </TooltipTrigger>
        <TooltipContent>Este token se quita de ACCESS_DEVS / ACCESS_ADMINS en Coolify.</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onRevoke(token)} aria-label={`Revocar ${token.label}`}>
      <Ban /> Revocar
    </Button>
  )
}
