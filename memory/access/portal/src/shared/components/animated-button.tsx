import { forwardRef } from 'react'
import { Pressable } from '@/shared/motion/pressable'
import { Button, type ButtonProps } from '@/shared/ui/button'
import { Spinner } from './spinner'

interface AnimatedButtonProps extends ButtonProps {
  isLoading?: boolean
}

/** Boton con respuesta fisica al pulsar y estado de carga. Es el boton que se usa en las pantallas. */
export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ isLoading = false, disabled, children, className, ...props }, ref) => (
    <Pressable className={className?.includes('w-full') ? 'flex w-full' : 'inline-flex'}>
      <Button ref={ref} disabled={disabled || isLoading} className={className} {...props}>
        {isLoading ? <Spinner /> : null}
        {children}
      </Button>
    </Pressable>
  ),
)
AnimatedButton.displayName = 'AnimatedButton'
