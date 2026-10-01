import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { IssuedCredentialsPanel } from '@/features/user-management/components/issued-credentials-panel'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useRotateOwnToken } from '../hooks/use-rotate-own-token'

interface RotateOwnTokenCardProps {
  userId: string
  /** Si el token se gestiona en Coolify no se puede cambiar desde aqui. */
  canRotate: boolean
}

export function RotateOwnTokenCard({ userId, canRotate }: RotateOwnTokenCardProps) {
  const { mutate, data: issued, isPending, isError, error, reset } = useRotateOwnToken()
  const [open, setOpen] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) window.setTimeout(reset, 200)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token del MCP</CardTitle>
        <CardDescription>Es lo que usa tu editor para hablar con la memoria. Si lo sospechas filtrado, genera uno nuevo.</CardDescription>
      </CardHeader>
      <CardContent>
        {canRotate ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <KeyRound /> Generar token nuevo
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Tu token lo gestiona un administrador en Coolify.</p>
        )}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generar token nuevo</DialogTitle>
              <DialogDescription>
                {issued ? 'Vuelve a conectarte con el comando nuevo.' : 'El token actual deja de funcionar y tendrás que reconectar tu editor.'}
              </DialogDescription>
            </DialogHeader>
            {issued ? <IssuedCredentialsPanel credentials={issued} /> : null}
            {isError ? (
              <p className="text-sm text-destructive" role="alert">
                {describeApiError(error)}
              </p>
            ) : null}
            <DialogFooter>
              {issued ? (
                <AnimatedButton onClick={() => handleOpenChange(false)}>Listo</AnimatedButton>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                    Cancelar
                  </Button>
                  <AnimatedButton onClick={() => mutate(userId)} isLoading={isPending}>
                    Generar token
                  </AnimatedButton>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
