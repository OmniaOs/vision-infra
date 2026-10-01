import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'
import { Input } from '@/shared/ui/input'

/** Campo de contrasena con boton para mostrarla u ocultarla. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    )
  },
)
PasswordField.displayName = 'PasswordField'
