import { Maximize2, Minus, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'

interface GraphZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

export function GraphZoomControls({ onZoomIn, onZoomOut, onFit }: GraphZoomControlsProps) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
      <Button variant="secondary" size="icon" className="size-8 shadow-md" onClick={onZoomIn} aria-label="Acercar">
        <Plus />
      </Button>
      <Button variant="secondary" size="icon" className="size-8 shadow-md" onClick={onZoomOut} aria-label="Alejar">
        <Minus />
      </Button>
      <Button variant="secondary" size="icon" className="size-8 shadow-md" onClick={onFit} aria-label="Ver todo">
        <Maximize2 />
      </Button>
    </div>
  )
}
