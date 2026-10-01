import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/shared/components/empty-state'
import { Button } from '@/shared/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Esta página no existe"
        description="Puede que el enlace esté mal escrito o que ya no exista."
        action={
          <Button asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
        }
      />
    </div>
  )
}
