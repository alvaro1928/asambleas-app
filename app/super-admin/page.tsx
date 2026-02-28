'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Building2, Loader2, Gift, Users, DollarSign, BarChart3, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ResumenPagos {
  conjuntos_que_pagaron: number
  dinero_total_centavos: number
}

interface EstadoSistema {
  tokens_vendidos: number
  tokens_regalados_estimado: number
  bono_bienvenida: number
  total_gestores: number
  ranking_gestores: Array<{ user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }>
}

interface ConjuntoRow {
  id: string
  name: string
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [conjuntos, setConjuntos] = useState<ConjuntoRow[]>([])
  const [resumen, setResumen] = useState<ResumenPagos | null>(null)
  const [estadoSistema, setEstadoSistema] = useState<EstadoSistema | null>(null)
  const [loading, setLoading] = useState(true)

  const isAllowed = (email: string | undefined) => {
    if (!email) return false
    const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
    if (!allowed) return false
    return email.trim().toLowerCase() === allowed
  }

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.email) {
          router.replace('/login?redirect=/super-admin')
          return
        }
        if (!isAllowed(session.user.email)) {
          router.replace('/login?redirect=/super-admin')
          return
        }
        const res = await fetch('/api/super-admin/conjuntos', { credentials: 'include' })
        if (res.status === 401 || res.status === 403) {
          router.replace('/login?redirect=/super-admin')
          return
        }
        if (!res.ok) return
        const data = await res.json()
        setConjuntos(data.conjuntos ?? [])
        setResumen(data.resumen ?? null)
        const estadoRes = await fetch('/api/super-admin/estado-sistema', { credentials: 'include' })
        if (estadoRes.ok) {
          const estadoData = await estadoRes.json()
          setEstadoSistema(estadoData)
        }
      } catch {
        router.replace('/login?redirect=/super-admin')
      } finally {
        setLoading(false)
      }
    }
    checkAndLoad()
  }, [router])

  const formatDinero = (centavos: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(centavos / 100)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Resumen
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total conjuntos</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{conjuntos.length}</p>
              </div>
            </div>
          </div>
          {estadoSistema != null && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Gestores</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{estadoSistema.total_gestores}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Usuarios con conjuntos</p>
                </div>
              </div>
            </div>
          )}
          {resumen != null && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Conjuntos que pagaron</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{resumen.conjuntos_que_pagaron}</p>
                </div>
              </div>
            </div>
          )}
          {estadoSistema != null && (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                    <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Créditos vendidos</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{estadoSistema.tokens_vendidos}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Por pagos APPROVED</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                    <Gift className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Créditos regalados (est.)</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{estadoSistema.tokens_regalados_estimado}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bono × gestores</p>
                  </div>
                </div>
              </div>
            </>
          )}
          {resumen != null && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Dinero recaudado</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{formatDinero(resumen.dinero_total_centavos)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 pt-4">
          <Link href="/super-admin/conjuntos">
            <Button variant="outline" className="gap-2">Ver Conjuntos</Button>
          </Link>
          <Link href="/super-admin/creditos">
            <Button variant="outline" className="gap-2">Ver Créditos</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
