import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { describeApiError } from '@/shared/api/describe-api-error'
import { AnimatedButton } from '@/shared/components/animated-button'
import { formatDateTime } from '@/shared/lib/format-date'
import { toast } from '@/shared/toast/toast'
import type { UserRecord } from '@/shared/types/user-record'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useAccessSettings, useSetEnforce } from '../hooks/use-space-queries'
import type { NamespaceRow } from '../types/space-types'

interface PermissionsModeCardProps {
  users: UserRecord[]
  /** Namespaces y proyectos: lo que aun no pertenece a ningun espacio. */
  rows: NamespaceRow[]
}

/** Decide si los permisos bloquean o solo registran, y muestra lo que el bloqueo habria denegado. */
export function PermissionsModeCard({ users, rows }: PermissionsModeCardProps) {
  const { data: settings } = useAccessSettings()
  const setEnforce = useSetEnforce()
  const [confirming, setConfirming] = useState(false)
  if (!settings) return null

  const withoutSpaces = users.filter((user) => user.role !== 'admin' && user.spaces.length === 0)
  const unassigned = rows.filter((row) => !row.space && (row.count ?? 1) > 0)
  const { wouldDeny } = settings

  const change = (enforce: boolean) =>
    setEnforce.mutate(enforce, {
      onSuccess: () => {
        toast.success(enforce ? 'Permisos activados' : 'Vuelve a solo registrar', enforce ? 'Lo que no corresponda ya se bloquea.' : 'Se registra lo que se bloquearía, sin bloquear.')
        setConfirming(false)
      },
    })

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            {settings.enforce ? <ShieldCheck className="size-5 text-success" aria-hidden /> : <ShieldAlert className="size-5 text-amber" aria-hidden />}
            Permisos de acceso
            <Badge variant={settings.enforce ? 'success' : 'amber'}>{settings.enforce ? 'Bloqueando' : 'Solo registrando'}</Badge>
          </CardTitle>
          <CardDescription>
            {settings.memoryBackend === 'native' ? 'Memorias: servicio propio, sin IA al escribir. ' : 'Memorias: OpenMemory (antiguo, la IA puede reescribir lo que guardas). '}
            {settings.enforce
              ? 'Quien intente leer o escribir fuera de sus espacios recibe un rechazo, en Mem0 y en las notas.'
              : 'Nadie queda bloqueado todavía: se registra lo que se bloquearía. Revísalo y activa el bloqueo cuando salga limpio.'}
          </CardDescription>
        </div>
        {settings.enforcedByEnv ? (
          <span className="text-xs text-muted-foreground">Forzado desde Coolify</span>
        ) : (
          <Button variant={settings.enforce ? 'outline' : 'default'} onClick={() => (settings.enforce ? change(false) : setConfirming(true))}>
            {settings.enforce ? 'Volver a solo registrar' : 'Activar bloqueo'}
          </Button>
        )}
      </CardHeader>
      {!settings.enforce ? (
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-semibold tabular-nums">{wouldDeny.total}</span> intentos se habrían bloqueado desde el {formatDateTime(wouldDeny.since)}.
          </p>
          {wouldDeny.recent.length > 0 ? (
            <ul className="space-y-1 rounded-xl border bg-muted/30 p-3 font-mono text-xs">
              {wouldDeny.recent.slice(0, 5).map((entry) => (
                <li key={`${entry.t}-${entry.reason}`} className="truncate">
                  {formatDateTime(entry.t)} · {entry.dev} · {entry.route} · {entry.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Activar el bloqueo de permisos?</DialogTitle>
            <DialogDescription>Desde ese momento, cada persona solo accede a los espacios que tiene asignados. Puedes volver a solo registrar cuando quieras.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            <li className={withoutSpaces.length ? 'text-amber' : 'text-success'}>
              {withoutSpaces.length ? `${withoutSpaces.length} persona${withoutSpaces.length === 1 ? '' : 's'} sin espacios (solo verán el global): ${withoutSpaces.map((u) => u.id).join(', ')}` : 'Todas las personas tienen espacios asignados.'}
            </li>
            <li className={unassigned.length ? 'text-amber' : 'text-success'}>
              {unassigned.length ? `${unassigned.length} namespace${unassigned.length === 1 ? '' : 's'} o proyecto${unassigned.length === 1 ? '' : 's'} sin espacio (solo los verá un admin): ${unassigned.map((r) => r.namespace).join(', ')}` : 'No queda nada sin espacio.'}
            </li>
            <li>{wouldDeny.total === 0 ? 'No se ha registrado ningún intento que se bloquearía.' : `Se registraron ${wouldDeny.total} intentos que se habrían bloqueado.`}</li>
          </ul>
          {setEnforce.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {describeApiError(setEnforce.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <AnimatedButton onClick={() => change(true)} isLoading={setEnforce.isPending}>
              Activar bloqueo
            </AnimatedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
