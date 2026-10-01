import { Badge } from '@/shared/ui/badge'

/** Si la persona ya eligio su contrasena del portal o todavia tiene la invitacion pendiente. */
export function UserPortalStatus({ hasPassword }: { hasPassword: boolean }) {
  return hasPassword ? (
    <Badge variant="success">Con acceso</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Sin contraseña
    </Badge>
  )
}
