'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Coins, Loader2, Users, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

interface EstadoSistema {
  tokens_vendidos: number
  tokens_regalados_estimado: number
  total_gestores: number
  ranking_gestores: Array<{ user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }>
}

interface GestorRow {
  user_id: string
  email: string | null
  full_name: string | null
  tokens_disponibles: number
}

export default function SuperAdminCreditosPage() {
  const router = useRouter()
  const toast = useToast()
  const [estadoSistema, setEstadoSistema] = useState<EstadoSistema | null>(null)
  const [gestores, setGestores] = useState<GestorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [gestoresError, setGestoresError] = useState<string | null>(null)
  const [gestoresHint, setGestoresHint] = useState<string | null>(null)
  const [tokensGestor, setTokensGestor] = useState<Record<string, string>>({})
  const [agregarTokensGestor, setAgregarTokensGestor] = useState<Record<string, string>>({})
  const [updatingTokensGestorId, setUpdatingTokensGestorId] = useState<string | null>(null)
  const [searchGestor, setSearchGestor] = useState('')

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
          router.replace('/login?redirect=/super-admin/creditos')
          return
        }
        const estadoRes = await fetch('/api/super-admin/estado-sistema', { credentials: 'include' })
        if (estadoRes.ok) setEstadoSistema(await estadoRes.json())
        const gestoresRes = await fetch('/api/super-admin/gestores', { credentials: 'include' })
        setGestoresError(null)
        setGestoresHint(null)
        if (gestoresRes.ok) {
          const data = await gestoresRes.json()
          setGestores(data.gestores ?? [])
          if (data._hint) setGestoresHint(data._hint)
        } else {
          const errData = await gestoresRes.json().catch(() => ({}))
          setGestoresError(errData.error || `Error ${gestoresRes.status}`)
        }
      } catch {
        router.replace('/login?redirect=/super-admin/creditos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const handleAplicarTokensGestor = async (userId: string) => {
    const raw = tokensGestor[userId]
    const value = raw === '' || raw === undefined ? null : Math.max(0, Math.round(Number(raw)))
    if (value === null) return
    setUpdatingTokensGestorId(userId)
    try {
      const res = await fetch('/api/super-admin/gestores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, tokens_disponibles: value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al actualizar')
        return
      }
      setGestores((prev) => prev.map((g) => (g.user_id === userId ? { ...g, tokens_disponibles: value } : g)))
      setTokensGestor((prev) => ({ ...prev, [userId]: '' }))
      toast.success('Créditos del gestor actualizados')
      const estadoRes = await fetch('/api/super-admin/estado-sistema', { credentials: 'include' })
      if (estadoRes.ok) setEstadoSistema(await estadoRes.json())
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setUpdatingTokensGestorId(null)
    }
  }

  const handleAgregarTokensGestor = async (userId: string) => {
    const g = gestores.find((x) => x.user_id === userId)
    const current = Math.max(0, Number(g?.tokens_disponibles ?? 0))
    const raw = agregarTokensGestor[userId]
    const sumar = raw === '' || raw === undefined ? 0 : Math.max(0, Math.round(Number(raw)))
    if (sumar <= 0) return
    const nuevoTotal = current + sumar
    setUpdatingTokensGestorId(userId)
    try {
      const res = await fetch('/api/super-admin/gestores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, tokens_disponibles: nuevoTotal }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al agregar')
        return
      }
      setGestores((prev) => prev.map((x) => (x.user_id === userId ? { ...x, tokens_disponibles: nuevoTotal } : x)))
      setAgregarTokensGestor((prev) => ({ ...prev, [userId]: '' }))
      toast.success(`Se agregaron ${sumar}. Nuevo saldo: ${nuevoTotal}`)
      const estadoRes = await fetch('/api/super-admin/estado-sistema', { credentials: 'include' })
      if (estadoRes.ok) setEstadoSistema(await estadoRes.json())
    } catch {
      toast.error('Error al agregar')
    } finally {
      setUpdatingTokensGestorId(null)
    }
  }

  const gestoresFiltrados = gestores.filter((g) => {
    const q = searchGestor.trim().toLowerCase()
    if (!q) return true
    const email = (g.email ?? '').toLowerCase()
    const name = (g.full_name ?? '').toLowerCase()
    return email.includes(q) || name.includes(q)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/super-admin" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>

      {estadoSistema != null && estadoSistema.ranking_gestores.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              Ranking por saldo disponible
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[200px]">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Email / Nombre</th>
                  <th className="px-4 py-3 text-right">Créditos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {estadoSistema.ranking_gestores.map((g, i) => (
                  <tr key={g.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white truncate">
                      {g.email ?? g.full_name?.trim() ?? 'Usuario (sin email)'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{g.tokens_disponibles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Créditos — Gestores</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Ver saldo y asignar créditos por gestor.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-none min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar por email o nombre..."
                value={searchGestor}
                onChange={(e) => setSearchGestor(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-full sm:w-48 sm:min-w-[12rem]"
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
              {gestoresFiltrados.length} de {gestores.length}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[280px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 sm:px-6 py-3">Email / Nombre</th>
                <th className="px-4 sm:px-6 py-3">Créditos</th>
                <th className="px-4 sm:px-6 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {gestoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 sm:px-6 py-12 text-center">
                    <div className="text-gray-500 space-y-2">
                      {gestoresError ? (
                        <p className="font-medium text-amber-600 dark:text-amber-400">{gestoresError}</p>
                      ) : gestores.length === 0 ? (
                        <>
                          <p>No hay gestores en la lista.</p>
                          {gestoresHint && (
                            <p className="text-sm p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">{gestoresHint}</p>
                          )}
                        </>
                      ) : (
                        'Ningún gestor coincide con el filtro.'
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                gestoresFiltrados.map((g) => (
                  <tr key={g.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {g.email ?? g.full_name?.trim() ?? 'Usuario (sin email)'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Saldo: {g.tokens_disponibles ?? 0}</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="Ej: 80"
                            value={tokensGestor[g.user_id] ?? ''}
                            onChange={(e) => setTokensGestor((prev) => ({ ...prev, [g.user_id]: e.target.value }))}
                            className="w-24 sm:w-36 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingTokensGestorId === g.user_id}
                            onClick={() => handleAplicarTokensGestor(g.user_id)}
                          >
                            {updatingTokensGestorId === g.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Establecer'}
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="+ Sumar"
                            value={agregarTokensGestor[g.user_id] ?? ''}
                            onChange={(e) => setAgregarTokensGestor((prev) => ({ ...prev, [g.user_id]: e.target.value }))}
                            className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingTokensGestorId === g.user_id || !(Number(agregarTokensGestor[g.user_id]) > 0)}
                            onClick={() => handleAgregarTokensGestor(g.user_id)}
                          >
                            Sumar
                          </Button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-right text-gray-500 dark:text-gray-400 text-xs">Gestor</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
