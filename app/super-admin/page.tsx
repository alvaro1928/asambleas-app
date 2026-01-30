'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Shield, Building2, Loader2, LogOut, Gift, Users, DollarSign, Settings2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Super Administración: protegida solo para el email en NEXT_PUBLIC_ADMIN_EMAIL (Vercel / .env).
 * Incluye administración de planes (nombre, precio) y asignación de plan por conjunto.
 */

interface PlanRow {
  id: string
  key: string
  nombre: string
  precio_cop_anual: number
  activo?: boolean
}

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

const PLAN_OPTIONS = [
  { value: 'free', label: 'Gratis' },
  { value: 'pro', label: 'Pro' },
  { value: 'pilot', label: 'Piloto' },
]

export default function SuperAdminPage() {
  const router = useRouter()
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [conjuntos, setConjuntos] = useState<ConjuntoRow[]>([])
  const [resumen, setResumen] = useState<ResumenPagos | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [planSelect, setPlanSelect] = useState<Record<string, string>>({})
  const [editingPlan, setEditingPlan] = useState<Record<string, { nombre: string; precio_cop_anual: number }>>({})
  const [savingPlanKey, setSavingPlanKey] = useState<string | null>(null)

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

  const loadPlanes = async () => {
    const res = await fetch('/api/super-admin/planes', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    const list = (data.planes || []).map((p: PlanRow) => ({
      id: p.id,
      key: p.key,
      nombre: p.nombre,
      precio_cop_anual: Number(p.precio_cop_anual) || 0,
      activo: p.activo,
    }))
    setPlanes(list)
    const edit: Record<string, { nombre: string; precio_cop_anual: number }> = {}
    list.forEach((p: PlanRow) => {
      edit[p.key] = { nombre: p.nombre, precio_cop_anual: p.precio_cop_anual }
    })
    setEditingPlan(edit)
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

      await loadPlanes()

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
      const sel: Record<string, string> = {}
      rows.forEach((c: ConjuntoRow) => {
        sel[c.id] = c.plan_type
      })
      setPlanSelect(sel)
    } catch (e) {
      console.error('Super admin load:', e)
      router.replace('/login?redirect=/super-admin')
    } finally {
      setLoading(false)
    }
  }

  const handleAplicarPlan = async (id: string, planType: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/super-admin/conjuntos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, plan_type: planType }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Error al aplicar plan')
        return
      }

      setConjuntos((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                plan_type: planType,
                plan_status: planType === 'free' ? 'inactive' : 'active',
              }
            : c
        )
      )
      setPlanSelect((prev) => ({ ...prev, [id]: planType }))
    } catch (e) {
      console.error('Aplicar plan:', e)
      alert('Error al aplicar plan')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleActivarCortesiaPiloto = async (id: string) => {
    await handleAplicarPlan(id, 'pro')
  }

  const handleSavePlan = async (key: string) => {
    const edit = editingPlan[key]
    if (!edit) return
    setSavingPlanKey(key)
    try {
      const res = await fetch('/api/super-admin/planes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key,
          nombre: edit.nombre.trim(),
          precio_cop_anual: Math.max(0, Math.round(edit.precio_cop_anual)),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Error al guardar plan')
        return
      }

      setPlanes((prev) =>
        prev.map((p) =>
          p.key === key
            ? {
                ...p,
                nombre: edit.nombre.trim(),
                precio_cop_anual: Math.max(0, Math.round(edit.precio_cop_anual)),
              }
            : p
        )
      )
    } catch (e) {
      console.error('Guardar plan:', e)
      alert('Error al guardar plan')
    } finally {
      setSavingPlanKey(null)
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
                Planes, conjuntos y pagos
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Administración de planes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Administración de planes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Key</th>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Precio / año (COP)</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {planes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No hay planes. Ejecuta el script <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">supabase/PLANES-TABLA-Y-SEED.sql</code> en Supabase.
                    </td>
                  </tr>
                ) : (
                  planes.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{p.key}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editingPlan[p.key]?.nombre ?? p.nombre}
                          onChange={(e) =>
                            setEditingPlan((prev) => ({
                              ...prev,
                              [p.key]: {
                                ...(prev[p.key] ?? { nombre: p.nombre, precio_cop_anual: p.precio_cop_anual }),
                                nombre: e.target.value,
                              },
                            }))
                          }
                          className="w-full max-w-[140px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min={0}
                          value={editingPlan[p.key]?.precio_cop_anual ?? p.precio_cop_anual}
                          onChange={(e) =>
                            setEditingPlan((prev) => ({
                              ...prev,
                              [p.key]: {
                                ...(prev[p.key] ?? { nombre: p.nombre, precio_cop_anual: p.precio_cop_anual }),
                                precio_cop_anual: Number(e.target.value) || 0,
                              },
                            }))
                          }
                          className="w-full max-w-[120px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSavePlan(p.key)}
                          disabled={savingPlanKey === p.key}
                          className="gap-1"
                        >
                          {savingPlanKey === p.key ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Guardar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

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

        {/* Conjuntos */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Conjuntos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Plan actual</th>
                  <th className="px-6 py-4">Estado suscripción</th>
                  <th className="px-6 py-4">Asignar plan</th>
                  <th className="px-6 py-4 text-right">Acción rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {conjuntos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
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
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {c.plan_status ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={planSelect[c.id] ?? c.plan_type}
                          onChange={(e) => setPlanSelect((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
                        >
                          {PLAN_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          disabled={updatingId === c.id || (planSelect[c.id] ?? c.plan_type) === c.plan_type}
                          onClick={() => handleAplicarPlan(c.id, planSelect[c.id] ?? c.plan_type)}
                        >
                          {updatingId === c.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Aplicar'
                          )}
                        </Button>
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
                          Pro 1 año
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
