'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Shield, Building2, Loader2, LogOut, Gift, Users, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Super Administración: protegida solo para el email en NEXT_PUBLIC_ADMIN_EMAIL (Vercel / .env).
 * La API usa SUPER_ADMIN_EMAIL o NEXT_PUBLIC_ADMIN_EMAIL; pon el mismo valor en ambas.
 */

interface ConjuntoRow {
  id: string
  name: string
  plan_type: string
  plan_status?: string | null
}

interface ResumenPagos {
  conjuntos_que_pagaron: number
  dinero_total_centavos: number
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [conjuntos, setConjuntos] = useState<ConjuntoRow[]>([])
  const [resumen, setResumen] = useState<ResumenPagos | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    checkAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAllowed = (email: string | undefined) => {
    if (!email) return false
    const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
    if (!allowed) return false
    return email.trim().toLowerCase() === allowed
  }

  const checkAndLoad = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user?.email) {
        router.replace('/login?redirect=/super-admin')
        return
      }

      if (!isAllowed(session.user.email)) {
        router.replace('/login?redirect=/super-admin')
        return
      }

      const res = await fetch('/api/super-admin/conjuntos', {
        credentials: 'include',
      })

      if (res.status === 401 || res.status === 403) {
        router.replace('/login?redirect=/super-admin')
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error(err)
        setLoading(false)
        return
      }

      const data = await res.json()
      const rows = (data.conjuntos || []).map((c: ConjuntoRow & { plan_type?: string }) => ({
        id: c.id,
        name: c.name,
        plan_type: c.plan_type ?? 'free',
        plan_status: (c as { plan_status?: string | null }).plan_status ?? null,
      }))
      setConjuntos(rows)
      setResumen(data.resumen ?? null)
    } catch (e) {
      console.error('Super admin load:', e)
      router.replace('/login?redirect=/super-admin')
    } finally {
      setLoading(false)
    }
  }

  const handleActivarCortesiaPiloto = async (id: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/super-admin/conjuntos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, activar_cortesia: true }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Error al activar cortesía')
        return
      }

      setConjuntos((prev) =>
        prev.map((c) => (c.id === id ? { ...c, plan_type: 'pro', plan_status: 'active' } : c))
      )
    } catch (e) {
      console.error('Activar cortesía:', e)
      alert('Error al activar cortesía')
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDinero = (centavos: number) => {
    const pesos = centavos / 100
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(pesos)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Super Administración
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Conjuntos y planes (solo tu email)
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Ir al Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {resumen != null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Conjuntos que han pagado</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {resumen.conjuntos_que_pagaron}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Dinero total recaudado</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatDinero(resumen.dinero_total_centavos)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Plan actual</th>
                  <th className="px-6 py-4">Estado suscripción</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {conjuntos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No hay conjuntos registrados.
                    </td>
                  </tr>
                ) : (
                  conjuntos.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {c.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            c.plan_type === 'pro'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : c.plan_type === 'pilot'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {c.plan_type ?? 'free'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 dark:text-gray-400">
                          {c.plan_status ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivarCortesiaPiloto(c.id)}
                          disabled={updatingId === c.id || c.plan_type === 'pro'}
                          className="gap-2"
                        >
                          {updatingId === c.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Gift className="w-4 h-4" />
                          )}
                          Activar Cortesía (Piloto)
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
