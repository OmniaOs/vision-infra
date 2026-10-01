import { BrandMark } from './brand-logo'
import { Spinner } from './spinner'

/** Pantalla completa mientras se comprueba si ya hay una sesion abierta. */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <BrandMark className="size-14" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Cargando…
      </div>
    </div>
  )
}
