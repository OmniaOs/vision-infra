import { ArrowRight, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMyTokens } from '@/features/token-management/hooks/use-my-tokens'
import { formatRelativeTime } from '@/shared/lib/format-relative-time'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

/** Resumen de mis tokens con la puerta a la pagina donde se crean y revocan. */
export function MyTokensCard() {
  const { data: tokens = [] } = useMyTokens()
  const active = tokens.filter((token) => !token.revokedAt)
  const lastUsed = active.map((token) => token.lastUsedAt).filter(Boolean).sort().pop()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis tokens del MCP</CardTitle>
        <CardDescription>Lo que usan tus editores para hablar con la memoria. Crea uno por equipo y revoca el que sospeches filtrado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <KeyRound className="size-4 text-primary" aria-hidden />
          <span>
            <span className="font-semibold">{active.length}</span> activos · último uso {lastUsed ? formatRelativeTime(lastUsed) : 'nunca'}
          </span>
        </div>
        <Button asChild variant="outline">
          <Link to="/tokens">
            Administrar tokens <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
