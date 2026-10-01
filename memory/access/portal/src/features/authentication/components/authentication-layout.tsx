import type { ReactNode } from 'react'
import { BrandLogo } from '@/shared/components/brand-logo'
import { FadeIn } from '@/shared/motion/fade-in'
import { AuthenticationHero } from './authentication-hero'

/** Pantalla dividida: marca a la izquierda (solo en pantallas anchas) y el formulario a la derecha. */
export function AuthenticationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <AuthenticationHero />
      <main className="bg-dot-grid relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <FadeIn className="mb-10 lg:hidden">
            <BrandLogo />
          </FadeIn>
          {children}
        </div>
      </main>
    </div>
  )
}
