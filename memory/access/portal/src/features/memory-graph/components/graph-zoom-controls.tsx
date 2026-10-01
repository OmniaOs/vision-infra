import { Maximize2, Minus, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'

interface GraphZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function GraphZoomControls({ onZoomIn, onZoomOut, onReset }: GraphZoomControlsProps) {
  return (
    <div className="absolute right-3 top-3 flex flex-col gap-1.5">
      <Button variant="secondary" size="icon" className="size-8" onClick={onZoomIn} aria-label="Acercar">
        <Plus />
      </Button>
      <Button variant="secondary" size="icon" className="size-8" onClick={onZoomOut} aria-label="Alejar">
        <Minus />
      </Button>
      <Button variant="secondary" size="icon" className="size-8" onClick={onReset} aria-label="Restablecer vista">
        <Maximize2 />
      </Button>
    </div>
  )
}
