'use client'

import { type ComponentType, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Shield, Cookie, ScrollText, BookOpen, Loader2 } from 'lucide-react'
import { LEGAL_DOC_ORDER, type LegalDocKey, type LegalDocument } from '@/lib/legal-docs'
import { PublicSitePrimarySync } from '@/components/legal/public-site-primary-sync'
import { LandingLegalNav, landingLegalFocusRing } from '@/components/legal/landing-legal-nav'
import { cn } from '@/lib/utils'

const TAB_META: Record<LegalDocKey, { icon: ComponentType<{ className?: string }>; short: string }> = {
  terminos_condiciones: { icon: ScrollText, short: 'Términos' },
  eula: { icon: BookOpen, short: 'EULA' },
  politica_privacidad: { icon: Shield, short: 'Privacidad' },
  politica_cookies: { icon: Cookie, short: 'Cookies' },
}

export default function TerminosPublicosPage() {
  const [loading, setLoading] = useState(true)
  const [documentos, setDocumentos] = useState<LegalDocument[]>([])
  const [activa, setActiva] = useState<LegalDocKey>('terminos_condiciones')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/legal/public', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const docs = Array.isArray(data.documentos) ? (data.documentos as LegalDocument[]) : []
        if (!cancelled) {
          setDocumentos(docs)
          setActiva((prev) => {
            if (docs.length === 0) return prev
            return docs.some((d) => d.key === prev) ? prev : docs[0].key
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const docByKey = useMemo(() => new Map(documentos.map((d) => [d.key, d])), [documentos])
  const docActiva = docByKey.get(activa) ?? documentos[0]
  const DocIcon = docActiva ? TAB_META[docActiva.key].icon : ScrollText

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#f8f9ff] text-[#0b1c30] antialiased">
        <PublicSitePrimarySync />
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#4338ca]" aria-hidden />
          <p className="text-sm text-[#464554]">Cargando documentos legales...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] antialiased selection:bg-[#4338ca]/25 selection:text-[#0b1c30]">
      <PublicSitePrimarySync />
      <a
        href="#contenido-legal"
        className={cn(
          'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-[#0b1c30] focus:shadow-lg',
          landingLegalFocusRing
        )}
      >
        Saltar al contenido
      </a>
      <LandingLegalNav highlight="legal" />

      <div className="pt-24">
        <main id="contenido-legal" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2a14b4]">Legal</p>
              <h1 className="text-2xl font-extrabold tracking-tighter text-[#0b1c30] md:text-3xl">
                Documentos legales
              </h1>
              <p className="mt-1 text-sm text-[#464554]">Términos, EULA y políticas vigentes del servicio</p>
            </div>
            <div className="text-xs text-[#464554]">
              {docActiva?.ultima_actualizacion
                ? `Actualizado: ${docActiva.ultima_actualizacion}`
                : 'Actualizado recientemente'}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-[2rem] border border-slate-200/80 bg-white p-2 shadow-[0_20px_40px_rgba(11,28,48,0.05)]">
              <nav className="space-y-1" aria-label="Seleccionar documento legal">
                {LEGAL_DOC_ORDER.map((key) => {
                  const doc = docByKey.get(key)
                  if (!doc) return null
                  const Icon = TAB_META[key].icon
                  const active = key === docActiva?.key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiva(key)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-200',
                        active
                          ? 'border border-[#4338ca]/25 bg-[#e3dfff] font-semibold text-[#2a14b4] shadow-sm'
                          : 'border border-transparent text-[#464554] hover:bg-[#f8f9ff] hover:text-[#0b1c30]'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{TAB_META[key].short}</span>
                    </button>
                  )
                })}
              </nav>
            </aside>

            <section className="rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_20px_40px_rgba(11,28,48,0.05)] sm:p-7">
              {!docActiva ? (
                <div className="text-sm text-[#464554]">No hay contenido legal disponible.</div>
              ) : (
                <>
                  <div className="mb-6 flex items-start gap-3">
                    <div className="rounded-2xl bg-[#e3dfff] p-2 text-[#2a14b4]">
                      <DocIcon className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#0b1c30]">{docActiva.titulo}</h2>
                      <p className="mt-1 text-xs text-[#464554]">
                        Última actualización: {docActiva.ultima_actualizacion}
                      </p>
                    </div>
                  </div>
                  <article className="whitespace-pre-wrap text-sm leading-7 text-[#464554]">{docActiva.contenido}</article>
                </>
              )}
            </section>
          </div>
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
