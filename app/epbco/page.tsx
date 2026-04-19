import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Mail, Phone, Shield, Cpu, ExternalLink } from 'lucide-react'
import { PublicSitePrimarySync } from '@/components/legal/public-site-primary-sync'
import { LandingLegalNav, landingLegalFocusRing } from '@/components/legal/landing-legal-nav'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'EPBCO Solutions',
  description:
    'EPBCO Solutions — Automatización y soluciones digitales. Conoce nuestro producto para asambleas y votaciones online.',
}

const TEL = '573143104977'
const EMAIL = 'contactanos@epbco.cloud'

export default function EPBCOPage() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] antialiased selection:bg-[#4338ca]/25 selection:text-[#0b1c30]">
      <PublicSitePrimarySync />
      <a
        href="#contenido-epbco"
        className={cn(
          'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-[#0b1c30] focus:shadow-lg',
          landingLegalFocusRing
        )}
      >
        Saltar al contenido
      </a>
      <LandingLegalNav highlight="neutral" />

      <div className="pt-24">
        <main id="contenido-epbco" className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={cn(
              'mb-10 inline-flex text-sm font-medium text-[#4338ca] transition-colors hover:text-indigo-800',
              landingLegalFocusRing,
              'rounded-md'
            )}
          >
            ← Volver al inicio
          </Link>

          <header className="mb-14 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e3dfff] text-[#2a14b4] shadow-sm">
              <Building2 className="h-8 w-8" aria-hidden />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2a14b4]">Empresa</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tighter text-[#0b1c30] md:text-5xl">
              EPBCO Solutions
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed text-[#464554]">
              Automatización y soluciones digitales para empresas y comunidades.
            </p>
          </header>

          <section className="mb-14">
            <div className="mb-6 flex items-center justify-center gap-2 sm:justify-start">
              <Cpu className="h-6 w-6 shrink-0 text-[#4338ca]" aria-hidden />
              <h2 className="text-2xl font-bold tracking-tight text-[#0b1c30]">A qué nos dedicamos</h2>
            </div>
            <div className="space-y-4 leading-relaxed text-[#464554]">
              <p>
                Desarrollamos soluciones de software que automatizan procesos operativos y de gobierno: votaciones,
                actas, gestión de asambleas y cumplimiento normativo. Nuestro enfoque es entregar productos usables,
                seguros y alineados con la ley (por ejemplo, Ley 675 en Colombia).
              </p>
              <p>
                Trabajamos con administradores de propiedad horizontal, consejos de administración y empresas que
                buscan digitalizar y auditar sus procesos de forma confiable.
              </p>
            </div>
          </section>

          <section className="mb-14 rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_40px_rgba(11,28,48,0.05)] md:p-8">
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-[#0b1c30]">Nuestro producto</h2>
            <p className="mb-6 leading-relaxed text-[#464554]">
              <strong className="font-semibold text-[#0b1c30]">Asambleas App</strong> (VOTA TECH) es nuestra
              plataforma de votaciones online para asambleas de propiedad horizontal: quórum en tiempo real, actas,
              auditoría y cumplimiento Ley 675. Si quieres conocer la aplicación, precios y empezar a usarla, entra al
              sitio del producto.
            </p>
            <Link
              href="/"
              className={cn(
                'landing-primary-gradient inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white shadow-lg transition-transform active:scale-95',
                landingLegalFocusRing
              )}
            >
              Ir al sitio del producto
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </section>

          <section className="mb-14">
            <h2 className="mb-6 text-2xl font-bold tracking-tight text-[#0b1c30]">Contacto</h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <a
                href={`tel:${TEL}`}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-[#464554] shadow-sm transition-colors hover:border-[#4338ca]/30 hover:bg-[#f8f9ff] hover:text-[#0b1c30]',
                  landingLegalFocusRing
                )}
              >
                <Phone className="h-5 w-5 shrink-0 text-[#4338ca]" aria-hidden />
                <span>57 314 310 4977</span>
              </a>
              <a
                href={`mailto:${EMAIL}`}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-[#464554] shadow-sm transition-colors hover:border-[#4338ca]/30 hover:bg-[#f8f9ff] hover:text-[#0b1c30]',
                  landingLegalFocusRing
                )}
              >
                <Mail className="h-5 w-5 shrink-0 text-[#4338ca]" aria-hidden />
                <span>{EMAIL}</span>
              </a>
            </div>
          </section>

          <footer className="border-t border-slate-200 pt-8">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[#464554]">
              <Link
                href="/politica-privacidad"
                className={cn(
                  'inline-flex items-center gap-1.5 transition-colors hover:text-[#4338ca]',
                  landingLegalFocusRing,
                  'rounded-md'
                )}
              >
                <Shield className="h-4 w-4 shrink-0" aria-hidden />
                Política de Privacidad y Tratamiento de Datos
              </Link>
              <a
                href="/EULA-Asambleas-App.txt"
                download
                className={cn(
                  'transition-colors hover:text-[#4338ca]',
                  landingLegalFocusRing,
                  'rounded-md'
                )}
              >
                Descargar EULA
              </a>
              <Link
                href="/"
                className={cn('transition-colors hover:text-[#4338ca]', landingLegalFocusRing, 'rounded-md')}
              >
                Producto: Asambleas App
              </Link>
            </div>
            <p className="mt-6 text-center text-sm text-[#464554]">
              © {new Date().getFullYear()} EPBCO Solutions. Todos los derechos reservados.
            </p>
          </footer>
        </main>

        <div className="border-t border-slate-200 bg-slate-50 py-6 text-center">
          <Link
            href="/login"
            className={cn('text-sm font-medium text-[#4338ca] hover:underline', landingLegalFocusRing)}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
