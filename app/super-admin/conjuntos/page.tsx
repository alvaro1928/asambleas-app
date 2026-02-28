'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Building2, Loader2, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

interface ConjuntoRow {
  id: string
  name: string
}

export default function SuperAdminConjuntosPage() {
  const router = useRouter()
  const toast = useToast()
  const [conjuntos, setConjuntos] = useState<ConjuntoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchConjunto, setSearchConjunto] = useState('')
  const [mostrandoConjuntos, setMostrandoConjuntos] = useState(50)
  const PASOS_PAGINACION = 50

  useEffect(() => {
    setMostrandoConjuntos(PASOS_PAGINACION)
  }, [searchConjunto])

  const isAllowed = (email: string | undefined) => {
    if (!email) return false
    const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
    return allowed && email.trim().toLowerCase() === allowed
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.email || !isAllowed(session.user.email)) {
          router.replace('/login?redirect=/super-admin/conjuntos')
          return
        }
        const res = await fetch('/api/super-admin/conjuntos', { credentials: 'include' })
        if (res.status === 401 || res.status === 403) {
          router.replace('/login?redirect=/super-admin/conjuntos')
          return
        }
        if (!res.ok) return
        const data = await res.json()
        const rows = (data.conjuntos || []).map((c: ConjuntoRow) => ({ id: c.id, name: c.name }))
        setConjuntos(rows)
      } catch {
        router.replace('/login?redirect=/super-admin/conjuntos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const conjuntosFiltrados = conjuntos.filter((c) =>
    !searchConjunto.trim() || c.name.toLowerCase().includes(searchConjunto.trim().toLowerCase())
  )
  const conjuntosVisibles = conjuntosFiltrados.slice(0, mostrandoConjuntos)
  const hayMas = conjuntosFiltrados.length > mostrandoConjuntos

  const exportarCSV = () => {
    const headers = ['Nombre']
    const rows = conjuntosFiltrados.map((c) => [c.name])
    const csv = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conjuntos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Lista exportada correctamente')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/super-admin" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Conjuntos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Listado de organizaciones. Los créditos se gestionan por gestor en Créditos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-none min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchConjunto}
                onChange={(e) => setSearchConjunto(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-full sm:w-48 sm:min-w-[12rem]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              Exportar CSV
            </Button>
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
              {conjuntosVisibles.length} de {conjuntosFiltrados.length}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[200px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 sm:px-6 py-3">Nombre</th>
                <th className="px-4 sm:px-6 py-3 text-right">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {conjuntosVisibles.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 sm:px-6 py-12 text-center text-gray-500">
                    {conjuntos.length === 0
                      ? 'No hay conjuntos registrados.'
                      : 'Ningún conjunto coincide con el filtro.'}
                  </td>
                </tr>
              ) : (
                conjuntosVisibles.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-gray-500 dark:text-gray-400 text-xs">Organización</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {hayMas && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setMostrandoConjuntos((n) => n + PASOS_PAGINACION)}>
              Cargar más
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
