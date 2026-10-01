import { BookOpenText, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandLogo } from '@/shared/components/brand-logo'
import { StaggerGroup } from '@/shared/motion/stagger-group'
import { StaggerItem } from '@/shared/motion/stagger-item'
import { MemoryConstellation } from './memory-constellation'

const HIGHLIGHTS = [
  { icon: Sparkles, tone: 'text-primary', title: 'Lecciones cortas', text: 'Cada hallazgo, una oración: se busca en segundos desde cualquier repo.' },
  { icon: BookOpenText, tone: 'text-amber', title: 'Notas largas', text: 'Incidentes y arquitecturas completas, con su causa y su solución.' },
  { icon: ShieldCheck, tone: 'text-success', title: 'Acceso por espacios', text: 'Cada persona ve solo lo que le corresponde. Los clientes, solo lo suyo.' },
] as const

/** Panel de marca de la pantalla de entrada: red de nodos al fondo y el mensaje del producto. */
export function AuthenticationHero() {
  return (
    <div className="relative hidden overflow-hidden border-r bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
      <MemoryConstellation className="absolute inset-0 size-full opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/55 to-card/10" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-card/70 via-transparent to-transparent" aria-hidden />

      <div className="relative">
        <BrandLogo />
      </div>

      <StaggerGroup className="relative max-w-xl space-y-10" delay={0.15}>
        <StaggerItem className="space-y-4">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            Lo que uno resuelve, <span className="text-primary">lo sabe todo el equipo.</span>
          </h2>
          <p className="max-w-md text-lg text-muted-foreground">
            La memoria compartida de Omnia: una sola fuente para tu equipo y tus clientes, sin depender de quién sabe hacer qué.
          </p>
        </StaggerItem>
        <ul className="space-y-5">
          {HIGHLIGHTS.map(({ icon: Icon, tone, title, text }) => (
            <StaggerItem key={title} className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background/70 backdrop-blur">
                <Icon className={`size-5 ${tone}`} aria-hidden />
              </div>
              <li className="list-none">
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </li>
            </StaggerItem>
          ))}
        </ul>
      </StaggerGroup>

      <div className="relative flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" /> Mem0
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber" /> Basic Memory
        </span>
      </div>
    </div>
  )
}
