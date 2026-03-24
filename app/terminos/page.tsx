'use client'

import { type ComponentType, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Shield, Cookie, ScrollText, BookOpen, ArrowLeft, Loader2, Home } from 'lucide-react'
import { LEGAL_DOC_ORDER, type LegalDocKey, type LegalDocument } from '@/lib/legal-docs'

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Cargando documentos legales...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white inline-flex items-center gap-1.5"
              title="Volver al inicio"
            >
              <ArrowLeft className="w-5 h-5" />
              <Home className="w-4 h-4 sm:hidden" aria-hidden />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">Documentos legales</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                Términos, EULA y políticas vigentes del servicio
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {docActiva?.ultima_actualizacion ? `Actualizado: ${docActiva.ultima_actualizacion}` : 'Actualizado recientemente'}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <aside className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-2 h-fit">
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
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{TAB_META[key].short}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-7">
            {!docActiva ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">No hay contenido legal disponible.</div>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                    <DocIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{docActiva.titulo}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Última actualización: {docActiva.ultima_actualizacion}
                    </p>
                  </div>
                </div>
                <article className="text-sm leading-7 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {docActiva.contenido}
                </article>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
