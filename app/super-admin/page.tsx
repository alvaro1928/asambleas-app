'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Shield, Building2, Loader2, LogOut, Gift, Users, DollarSign, Settings2, Save, Search, Layout, BarChart3, Coins, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

/**
 * Super Administración: protegida solo para el email en NEXT_PUBLIC_ADMIN_EMAIL (Vercel / .env).
 * Conjuntos, gestores (tokens por gestor), precio global en Ajustes. Sin planes ni suscripciones.
 */

interface ConjuntoRow {
  id: string
  name: string
  plan_type: string
  plan_status?: string | null
  tokens_disponibles?: number
}

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

interface GestorRow {
  user_id: string
  email: string | null
  full_name: string | null
  tokens_disponibles: number
}

export default function SuperAdminPage() {
  const router = useRouter()
  const toast = useToast()
  const [conjuntos, setConjuntos] = useState<ConjuntoRow[]>([])
  const [resumen, setResumen] = useState<ResumenPagos | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [searchConjunto, setSearchConjunto] = useState('')
  const [mostrandoConjuntos, setMostrandoConjuntos] = useState(50)
  const PASOS_PAGINACION = 50
  const [landingTitulo, setLandingTitulo] = useState('')
  const [landingSubtitulo, setLandingSubtitulo] = useState('')
  const [landingWhatsapp, setLandingWhatsapp] = useState('')
  const [savingLanding, setSavingLanding] = useState(false)
  const [estadoSistema, setEstadoSistema] = useState<EstadoSistema | null>(null)
  const [gestores, setGestores] = useState<GestorRow[]>([])
  const [gestoresError, setGestoresError] = useState<string | null>(null)
  const [gestoresHint, setGestoresHint] = useState<string | null>(null)
  const [tokensGestor, setTokensGestor] = useState<Record<string, string>>({})
  const [agregarTokensGestor, setAgregarTokensGestor] = useState<Record<string, string>>({})
  const [updatingTokensGestorId, setUpdatingTokensGestorId] = useState<string | null>(null)
  const [searchGestor, setSearchGestor] = useState('')

  useEffect(() => {
    checkAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setMostrandoConjuntos(PASOS_PAGINACION)
  }, [searchConjunto])

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

      const configRes = await fetch('/api/super-admin/configuracion-landing', { credentials: 'include' })
      if (configRes.ok) {
        const configData = await configRes.json()
        setLandingTitulo(configData.titulo ?? '')
        setLandingSubtitulo(configData.subtitulo ?? '')
        setLandingWhatsapp(configData.whatsapp_number ?? '')
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
      const rows = (data.conjuntos || []).map((c: ConjuntoRow & { plan_type?: string; tokens_disponibles?: number }) => ({
        id: c.id,
        name: c.name,
        plan_type: c.plan_type ?? 'free',
        plan_status: (c as { plan_status?: string | null }).plan_status ?? null,
        tokens_disponibles: Math.max(0, Number((c as { tokens_disponibles?: number }).tokens_disponibles ?? 0)),
      }))
      setConjuntos(rows)
      setResumen(data.resumen ?? null)

      const estadoRes = await fetch('/api/super-admin/estado-sistema', { credentials: 'include' })
      if (estadoRes.ok) {
        const estadoData = await estadoRes.json()
        setEstadoSistema(estadoData)
      }

      const gestoresRes = await fetch('/api/super-admin/gestores', { credentials: 'include' })
      setGestoresError(null)
      setGestoresHint(null)
      if (gestoresRes.ok) {
        const gestoresData = await gestoresRes.json()
        setGestores(gestoresData.gestores ?? [])
        if (gestoresData._hint) setGestoresHint(gestoresData._hint)
      } else {
        const errData = await gestoresRes.json().catch(() => ({}))
        setGestoresError(errData.error || `Error ${gestoresRes.status} al cargar gestores`)
      }
    } catch (e) {
      console.error('Super admin load:', e)
      router.replace('/login?redirect=/super-admin')
    } finally {
      setLoading(false)
    }
  }

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
        toast.error(err.error || 'Error al actualizar tokens')
        return
      }
      setGestores((prev) =>
        prev.map((g) => (g.user_id === userId ? { ...g, tokens_disponibles: value } : g))
      )
      setTokensGestor((prev) => ({ ...prev, [userId]: '' }))
      toast.success('Tokens del gestor actualizados')
      if (estadoSistema) {
        const estadoRes = await fetch('/api/super-admin/estado-sistema', { credentials: 'include' })
        if (estadoRes.ok) setEstadoSistema(await estadoRes.json())
      }
    } catch (e) {
      console.error('Aplicar tokens gestor:', e)
      toast.error('Error al actualizar tokens')
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
        toast.error(err.error || 'Error al agregar tokens')
        return
      }
      setGestores((prev) =>
        prev.map((x) => (x.user_id === userId ? { ...x, tokens_disponibles: nuevoTotal } : x))
      )
      setAgregarTokensGestor((prev) => ({ ...prev, [userId]: '' }))
      toast.success(`Se agregaron ${sumar} tokens. Nuevo saldo: ${nuevoTotal}`)
      if (estadoSistema) {
        const estadoRes = await fetch('/api/super-admin/estado-sistema', { credentials: 'include' })
        if (estadoRes.ok) setEstadoSistema(await estadoRes.json())
      }
    } catch (e) {
      console.error('Agregar tokens gestor:', e)
      toast.error('Error al agregar tokens')
    } finally {
      setUpdatingTokensGestorId(null)
    }
  }

  const handleSaveLanding = async () => {
    setSavingLanding(true)
    try {
      const res = await fetch('/api/super-admin/configuracion-landing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          titulo: landingTitulo.trim(),
          subtitulo: landingSubtitulo.trim(),
          whatsapp_number: landingWhatsapp.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al guardar')
        return
      }
      toast.success('Landing actualizada')
    } catch (e) {
      console.error('Guardar landing:', e)
      toast.error('Error al guardar')
    } finally {
      setSavingLanding(false)
    }
  }

  const conjuntosFiltrados = conjuntos.filter((c) =>
    !searchConjunto.trim() || c.name.toLowerCase().includes(searchConjunto.trim().toLowerCase())
  )
  const conjuntosVisibles = conjuntosFiltrados.slice(0, mostrandoConjuntos)

  const gestoresFiltrados = gestores.filter((g) => {
    const q = searchGestor.trim().toLowerCase()
    if (!q) return true
    const email = (g.email ?? '').toLowerCase()
    const name = (g.full_name ?? '').toLowerCase()
    const uid = (g.user_id ?? '').toLowerCase()
    return email.includes(q) || name.includes(q) || uid.includes(q)
  })
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

  const formatDinero = (centavos: number) => {
    const pesos = centavos / 100
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(pesos)
  }

  const formatPrecio = (cop: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cop)
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
                Conjuntos, créditos y configuración
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/super-admin/transacciones">
              <Button variant="outline" className="gap-2" title="Ver transacciones y pagos registrados">
                <Receipt className="w-4 h-4" />
                Transacciones y pagos
              </Button>
            </Link>
            <Link href="/super-admin/ajustes">
              <Button variant="outline" className="gap-2" title="Ajustes globales: landing y color principal">
                Ajustes
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="gap-2"
              title="Volver al panel principal del dashboard"
            >
              <LogOut className="w-4 h-4" />
              Ir al Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Estado del Sistema */}
        {estadoSistema != null && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-indigo-500/10 border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Estado del sistema (tokens)
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4 shadow-soft">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
                    <DollarSign className="w-4 h-4" />
                    Tokens vendidos
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{estadoSistema.tokens_vendidos}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total acreditados por pagos (APPROVED)</p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4 shadow-soft">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
                    <Gift className="w-4 h-4" />
                    Tokens regalados (est.)
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{estadoSistema.tokens_regalados_estimado}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{estadoSistema.bono_bienvenida} × {estadoSistema.total_gestores} gestores</p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4 shadow-soft">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
                    <Users className="w-4 h-4" />
                    Gestores
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{estadoSistema.total_gestores}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Usuarios con al menos un conjunto</p>
                </div>
              </div>
              {estadoSistema.ranking_gestores.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Ranking de gestores por saldo disponible
                  </h3>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Email / Nombre</th>
                          <th className="px-4 py-3 text-right">Tokens disponibles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {estadoSistema.ranking_gestores.map((g, i) => (
                          <tr key={g.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">{i + 1}</td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">
                              {g.email ?? g.full_name ?? g.user_id.slice(0, 8) + '…'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{g.tokens_disponibles}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Personalización de Landing */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-indigo-500/10 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Personalización de Landing
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título (hero)</label>
              <input
                type="text"
                value={landingTitulo}
                onChange={(e) => setLandingTitulo(e.target.value)}
                placeholder="Ej. Asambleas digitales para propiedad horizontal"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subtítulo (hero)</label>
              <textarea
                value={landingSubtitulo}
                onChange={(e) => setLandingSubtitulo(e.target.value)}
                placeholder="Ej. Votaciones en tiempo real, actas y auditoría..."
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp de contacto</label>
              <input
                type="text"
                value={landingWhatsapp}
                onChange={(e) => setLandingWhatsapp(e.target.value)}
                placeholder="Ej. 573001234567 (código país + número)"
                className="w-full max-w-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vacío = no mostrar botón WhatsApp en la landing</p>
            </div>
            <Button onClick={handleSaveLanding} disabled={savingLanding} className="gap-2">
              {savingLanding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </Button>
          </div>
        </div>

        {/* Gestores (cuentas de administradores): asignar tokens a super admin */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg shadow-indigo-500/10 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Gestores (cuentas de administradores)
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Cuentas que acceden con Google o magic link. Aquí puedes ver el saldo de tokens y asignar más.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por email o nombre..."
                  value={searchGestor}
                  onChange={(e) => setSearchGestor(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-48 sm:w-64"
                  title="Filtrar gestores"
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Mostrando {gestoresFiltrados.length} de {gestores.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Email / Nombre</th>
                  <th className="px-6 py-4">Tokens</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {gestoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="text-gray-500 space-y-2">
                        {gestoresError ? (
                          <>
                            <p className="font-medium text-amber-600 dark:text-amber-400">{gestoresError}</p>
                            <p className="text-sm">Si dice &quot;SUPABASE_SERVICE_ROLE_KEY no configurada&quot;, añádela en Vercel → proyecto → Settings → Environment Variables.</p>
                          </>
                        ) : gestores.length === 0 ? (
                          <>
                            <p>No hay gestores en la lista. <strong>No hace falta registrarse aparte</strong>: si iniciaste sesión y ves tokens en el Dashboard, ya eres gestor.</p>
                            {gestoresHint ? (
                              <p className="text-sm mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">{gestoresHint}</p>
                            ) : (
                              <p className="text-sm">La lista se llena desde la base de datos (tabla <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">profiles</code>). Revisa que <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> esté en Vercel y vuelve a desplegar.</p>
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {g.email ?? g.full_name ?? g.user_id.slice(0, 8) + '…'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Saldo: {g.tokens_disponibles ?? 0}</span>
                            <input
                              type="number"
                              min={0}
                              placeholder="Nuevo total"
                              value={tokensGestor[g.user_id] ?? ''}
                              onChange={(e) => setTokensGestor((prev) => ({ ...prev, [g.user_id]: e.target.value }))}
                              className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white"
                              title="Establecer nuevo saldo total"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={updatingTokensGestorId === g.user_id}
                              onClick={() => handleAplicarTokensGestor(g.user_id)}
                            >
                              {updatingTokensGestorId === g.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="number"
                              min={0}
                              placeholder="+ Agregar"
                              value={agregarTokensGestor[g.user_id] ?? ''}
                              onChange={(e) => setAgregarTokensGestor((prev) => ({ ...prev, [g.user_id]: e.target.value }))}
                              className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white"
                              title="Cantidad a sumar al saldo actual"
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
                      <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400 text-xs">
                        Cuenta gestor (Google / magic link)
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen: total conjuntos (modelo Billetera Central por tokens) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total conjuntos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{conjuntos.length}</p>
              </div>
            </div>
          </div>
        </div>

        {resumen != null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 p-5">
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
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 p-5">
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

        {/* Conjuntos (solo listado; los tokens son por gestor, no por conjunto) */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cuentas (conjuntos)</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Listado de organizaciones. Los tokens se gestionan por gestor arriba, no por conjunto.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchConjunto}
                  onChange={(e) => setSearchConjunto(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-48 sm:w-56"
                  title="Filtrar conjuntos por nombre"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportarCSV} title="Descargar lista de conjuntos en CSV">
                Exportar CSV
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Mostrando {conjuntosVisibles.length} de {conjuntosFiltrados.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4 text-right">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {conjuntosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                      {conjuntos.length === 0
                    ? 'No hay conjuntos registrados. Crea uno desde el Dashboard (Ir al Dashboard → Nuevo conjunto).'
                    : 'Ningún conjunto coincide con el filtro.'}
                    </td>
                  </tr>
                ) : (
                  conjuntosVisibles.map((c) => (
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
                      <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400 text-xs">
                        Organización
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hayMas && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setMostrandoConjuntos((n) => n + PASOS_PAGINACION)}
                title="Cargar más conjuntos"
              >
                Cargar más ({conjuntosVisibles.length} de {conjuntosFiltrados.length})
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
