'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Loader2, Save, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/providers/ToastProvider'
import { Button } from '@/components/ui/button'
import { getDefaultLegalDocs, LEGAL_DOC_ORDER, LEGAL_DOC_TITLES, type LegalDocKey, type LegalDocument } from '@/lib/legal-docs'

export default function SuperAdminLegalPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [docs, setDocs] = useState<Record<LegalDocKey, LegalDocument>>(() => {
    const base = getDefaultLegalDocs()
    return {
      terminos_condiciones: base[0],
      eula: base[1],
      politica_privacidad: base[2],
      politica_cookies: base[3],
    }
  })

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        router.replace('/login?redirect=/super-admin/legal')
        return
      }
      const res = await fetch('/api/super-admin/configuracion-legal', { credentials: 'include' })
      if (!res.ok) {
        toast.error('No fue posible cargar la configuración legal')
        setLoading(false)
        return
      }
      const data = await res.json().catch(() => ({}))
      const docsArr = Array.isArray(data.documentos) ? (data.documentos as LegalDocument[]) : getDefaultLegalDocs()
      const next: Record<LegalDocKey, LegalDocument> = {
        terminos_condiciones: docsArr.find((d) => d.key === 'terminos_condiciones') ?? getDefaultLegalDocs()[0],
        eula: docsArr.find((d) => d.key === 'eula') ?? getDefaultLegalDocs()[1],
        politica_privacidad: docsArr.find((d) => d.key === 'politica_privacidad') ?? getDefaultLegalDocs()[2],
        politica_cookies: docsArr.find((d) => d.key === 'politica_cookies') ?? getDefaultLegalDocs()[3],
      }
      setDocs(next)
      setLoading(false)
    }
    load()
  }, [router, toast])

  const updateDoc = (key: LegalDocKey, patch: Partial<LegalDocument>) => {
    setDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
  }

  const handleResetDefaults = () => {
    const base = getDefaultLegalDocs()
    setDocs({
      terminos_condiciones: base[0],
      eula: base[1],
      politica_privacidad: base[2],
      politica_cookies: base[3],
    })
    toast.success('Contenido legal restablecido a valores por defecto (falta guardar).')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = LEGAL_DOC_ORDER.map((key) => docs[key])
      const res = await fetch('/api/super-admin/configuracion-legal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentos: payload }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al guardar documentos legales')
        return
      }
      toast.success('Configuración legal guardada correctamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Cargando configuración legal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/super-admin" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Shield className="w-7 h-7 text-amber-500" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">Legal</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">Parametriza Términos, EULA y Políticas por defecto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleResetDefaults} className="rounded-xl">
              <RotateCcw className="w-4 h-4 mr-2" />
              Cargar por defecto
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {LEGAL_DOC_ORDER.map((key) => {
          const doc = docs[key]
          return (
            <section key={key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{LEGAL_DOC_TITLES[key]}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Título</label>
                  <input
                    type="text"
                    value={doc.titulo}
                    onChange={(e) => updateDoc(key, { titulo: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Última actualización</label>
                  <input
                    type="text"
                    value={doc.ultima_actualizacion}
                    onChange={(e) => updateDoc(key, { ultima_actualizacion: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Contenido</label>
                <textarea
                  rows={14}
                  value={doc.contenido}
                  onChange={(e) => updateDoc(key, { contenido: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm leading-6 text-gray-900 dark:text-white font-mono"
                />
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}

