import Link from 'next/link'
import { cn } from '@/lib/utils'

export const landingLegalFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4338ca] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9ff]'

export type LandingLegalNavHighlight = 'inicio' | 'legal'

interface LandingLegalNavProps {
  /** Qué enlace del menú central va resaltado (mismo criterio visual que el landing). */
  highlight?: LandingLegalNavHighlight
}

export function LandingLegalNav({ highlight = 'inicio' }: LandingLegalNavProps) {
  return (
    <nav
      aria-label="Principal"
      className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-none bg-white/80 px-6 py-5 shadow-[0_20px_40px_rgba(11,28,48,0.05)] backdrop-blur-md md:px-12"
    >
      <Link
        href="/"
        className={cn(
          'font-inter text-xl font-extrabold tracking-tighter text-indigo-700',
          landingLegalFocusRing,
          'rounded-md'
        )}
        style={{ fontFamily: 'inherit' }}
      >
        Asambleas Online
      </Link>
      <div className="hidden items-center gap-8 md:flex">
        <a
          href="/#funciones"
          className={cn(
            'text-sm font-medium tracking-tight transition-colors duration-200',
            highlight === 'inicio'
              ? 'border-b-2 border-indigo-700 font-bold text-indigo-700'
              : 'text-slate-600 hover:text-indigo-600'
          )}
        >
          Plataforma
        </a>
        <a
          href="/#como-funciona"
          className="text-sm font-medium tracking-tight text-slate-600 transition-colors duration-200 hover:text-indigo-600"
        >
          Cómo funciona
        </a>
        <a
          href="/#blockchain"
          className="text-sm font-medium tracking-tight text-slate-600 transition-colors duration-200 hover:text-indigo-600"
        >
          Blockchain
        </a>
        <Link
          href="/terminos"
          className={cn(
            'text-sm tracking-tight transition-colors duration-200',
            highlight === 'legal'
              ? 'border-b-2 border-indigo-700 font-bold text-indigo-700'
              : 'font-medium text-slate-600 hover:text-indigo-600'
          )}
        >
          Legal
        </Link>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href="/login"
          className={cn(
            'hidden px-2 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 sm:inline',
            landingLegalFocusRing,
            'rounded-md'
          )}
        >
          Acceso
        </Link>
        <Link
          href="/login"
          className={cn(
            'landing-primary-gradient inline-flex scale-95 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-90',
            landingLegalFocusRing
          )}
        >
          Comenzar
        </Link>
      </div>
    </nav>
  )
}
