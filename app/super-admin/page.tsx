'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Shield, Building2, Loader2, LogOut, Gift, Users, DollarSign, Settings2, Save, Search, Layout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

/**
 * Super Administración: protegida solo para el email en NEXT_PUBLIC_ADMIN_EMAIL (Vercel / .env).
 * Incluye administración de planes (nombre, precio, límites) y asignación de plan por conjunto.
 */

interface PlanRow {
  id: string
  key: string
  nombre: string
  precio_por_asamblea_cop: number
  activo?: boolean
  max_preguntas_por_asamblea?: number
  incluye_acta_detallada?: boolean
  tokens_iniciales?: number | null
  vigencia_meses?: number | null
}

type EditingPlanValue = {
  nombre: string
  precio_por_asamblea_cop: number
  max_preguntas_por_asamblea: number
  incluye_acta_detallada: boolean
  tokens_iniciales: number | null
  vigencia_meses: number | null
}

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

const PLAN_OPTIONS = [
  { value: 'free', label: 'Gratis' },
  { value: 'pro', label: 'Pro' },
  { value: 'pilot', label: 'Piloto' },
]

export default function SuperAdminPage() {
  const router = useRouter()
  const toast = useToast()
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [conjuntos, setConjuntos] = useState<ConjuntoRow[]>([])
  const [resumen, setResumen] = useState<ResumenPagos | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [planSelect, setPlanSelect] = useState<Record<string, string>>({})
  const [editingPlan, setEditingPlan] = useState<Record<string, EditingPlanValue>>({})
  const [savingPlanKey, setSavingPlanKey] = useState<string | null>(null)
  const [searchConjunto, setSearchConjunto] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [mostrandoConjuntos, setMostrandoConjuntos] = useState(50)
  const PASOS_PAGINACION = 50
  const [landingTitulo, setLandingTitulo] = useState('')
  const [landingSubtitulo, setLandingSubtitulo] = useState('')
  const [landingWhatsapp, setLandingWhatsapp] = useState('')
  const [savingLanding, setSavingLanding] = useState(false)
  const [tokensConjunto, setTokensConjunto] = useState<Record<string, string>>({})
  const [updatingTokensId, setUpdatingTokensId] = useState<string | null>(null)
  const [cargaMasivaFile, setCargaMasivaFile] = useState<File | null>(null)
  const [cargaMasivaLoading, setCargaMasivaLoading] = useState(false)
  const [cargaMasivaResult, setCargaMasivaResult] = useState<{ exitosos: number; fallidos: number; resultados: { fila: number; ok: boolean; error?: string }[] } | null>(null)

  useEffect(() => {
    checkAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setMostrandoConjuntos(PASOS_PAGINACION)
  }, [searchConjunto, filterPlan])

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
    const list = (data.planes || []).map((p: PlanRow & { precio_por_asamblea_cop?: number; max_preguntas_por_asamblea?: number; incluye_acta_detallada?: boolean; tokens_iniciales?: number | null; vigencia_meses?: number | null }) => ({
      id: p.id,
      key: p.key,
      nombre: p.nombre,
      precio_por_asamblea_cop: Number(p.precio_por_asamblea_cop) || 0,
      activo: p.activo,
      max_preguntas_por_asamblea: typeof p.max_preguntas_por_asamblea === 'number' ? p.max_preguntas_por_asamblea : (p.key === 'free' ? 2 : 999),
      incluye_acta_detallada: typeof p.incluye_acta_detallada === 'boolean' ? p.incluye_acta_detallada : p.key !== 'free',
      tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10),
      vigencia_meses: p.vigencia_meses ?? (p.key === 'free' ? null : p.key === 'pilot' ? 3 : 12),
    }))
    setPlanes(list)
    const edit: Record<string, EditingPlanValue> = {}
    list.forEach((p: PlanRow) => {
      edit[p.key] = {
        nombre: p.nombre,
        precio_por_asamblea_cop: p.precio_por_asamblea_cop,
        max_preguntas_por_asamblea: p.max_preguntas_por_asamblea ?? (p.key === 'free' ? 2 : 999),
        incluye_acta_detallada: p.incluye_acta_detallada ?? p.key !== 'free',
        tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10),
        vigencia_meses: p.vigencia_meses ?? (p.key === 'free' ? null : p.key === 'pilot' ? 3 : 12),
      }
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

  const handleAplicarTokens = async (id: string) => {
    const raw = tokensConjunto[id]
    const value = raw === '' || raw === undefined ? null : Math.max(0, Math.round(Number(raw)))
    if (value === null) return
    setUpdatingTokensId(id)
    try {
      const res = await fetch('/api/super-admin/conjuntos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, tokens_disponibles: value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al actualizar tokens')
        return
      }
      setConjuntos((prev) =>
        prev.map((c) => (c.id === id ? { ...c, tokens_disponibles: value } : c))
      )
      setTokensConjunto((prev) => ({ ...prev, [id]: '' }))
      toast.success('Tokens actualizados')
    } catch (e) {
      console.error('Aplicar tokens:', e)
      toast.error('Error al actualizar tokens')
    } finally {
      setUpdatingTokensId(null)
    }
  }

  const handleCargaMasivaPiloto = async () => {
    if (!cargaMasivaFile) {
      toast.error('Selecciona un archivo CSV')
      return
    }
    setCargaMasivaLoading(true)
    setCargaMasivaResult(null)
    try {
      const formData = new FormData()
      formData.append('file', cargaMasivaFile)
      const res = await fetch('/api/super-admin/carga-masiva-piloto', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Error en carga masiva')
        return
      }
      setCargaMasivaResult({
        exitosos: data.exitosos ?? 0,
        fallidos: data.fallidos ?? 0,
        resultados: data.resultados ?? [],
      })
      toast.success(`${data.exitosos ?? 0} cuenta(s) piloto asignada(s)`)
      if ((data.exitosos ?? 0) > 0) await checkAndLoad()
    } catch (e) {
      console.error('Carga masiva:', e)
      toast.error('Error en carga masiva')
    } finally {
      setCargaMasivaLoading(false)
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
        toast.error(err.error || 'Error al aplicar plan')
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
      toast.success('Plan aplicado al conjunto correctamente')
    } catch (e) {
      console.error('Aplicar plan:', e)
      toast.error('Error al aplicar plan')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleActivarCortesiaPiloto = async (id: string) => {
    await handleAplicarPlan(id, 'pro')
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

  const handleSavePlan = async (key: string) => {
    const edit = editingPlan[key]
    if (!edit) return
    setSavingPlanKey(key)
    try {
      const tokensIniciales = key === 'pro' ? null : (edit.tokens_iniciales === null || edit.tokens_iniciales === '' ? (key === 'free' ? 2 : 10) : Math.max(0, Math.round(Number(edit.tokens_iniciales))))
      const vigenciaMeses = key === 'free' ? null : (edit.vigencia_meses === null || edit.vigencia_meses === '' ? (key === 'pilot' ? 3 : 12) : Math.max(0, Math.round(Number(edit.vigencia_meses))))
      const res = await fetch('/api/super-admin/planes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key,
          nombre: edit.nombre.trim(),
          precio_por_asamblea_cop: Math.max(0, Math.round(edit.precio_por_asamblea_cop)),
          max_preguntas_por_asamblea: Math.max(0, Math.round(edit.max_preguntas_por_asamblea)),
          incluye_acta_detallada: edit.incluye_acta_detallada,
          tokens_iniciales: tokensIniciales,
          vigencia_meses: vigenciaMeses,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al guardar plan')
        return
      }

      setPlanes((prev) =>
        prev.map((p) =>
          p.key === key
            ? {
                ...p,
                nombre: edit.nombre.trim(),
                precio_por_asamblea_cop: Math.max(0, Math.round(edit.precio_por_asamblea_cop)),
                max_preguntas_por_asamblea: Math.max(0, Math.round(edit.max_preguntas_por_asamblea)),
                incluye_acta_detallada: edit.incluye_acta_detallada,
                tokens_iniciales: key === 'pro' ? null : Math.max(0, Math.round(Number(edit.tokens_iniciales ?? 0))),
                vigencia_meses: key === 'free' ? null : (edit.vigencia_meses == null || edit.vigencia_meses === '' ? (key === 'pilot' ? 3 : 12) : Math.max(0, Math.round(Number(edit.vigencia_meses)))),
              }
            : p
        )
      )
      toast.success('Plan actualizado correctamente')
    } catch (e) {
      console.error('Guardar plan:', e)
      toast.error('Error al guardar plan')
    } finally {
      setSavingPlanKey(null)
    }
  }

  const conjuntosFiltrados = conjuntos.filter((c) => {
    const matchName = !searchConjunto.trim() || c.name.toLowerCase().includes(searchConjunto.trim().toLowerCase())
    const matchPlan = filterPlan === 'all' || c.plan_type === filterPlan
    return matchName && matchPlan
  })
  const conjuntosVisibles = conjuntosFiltrados.slice(0, mostrandoConjuntos)
  const hayMas = conjuntosFiltrados.length > mostrandoConjuntos

  const resumenPorPlan = conjuntos.reduce(
    (acc, c) => {
      acc[c.plan_type] = (acc[c.plan_type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const exportarCSV = () => {
    const headers = ['Nombre', 'Plan', 'Estado suscripción']
    const rows = conjuntosFiltrados.map((c) => [
      c.name,
      c.plan_type,
      c.plan_status ?? ''
    ])
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
                Planes, conjuntos y pagos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Administración de planes */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-indigo-500/10 border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                  <th className="px-6 py-4">Precio / Asamblea (COP)</th>
                  <th className="px-6 py-4">Tokens iniciales</th>
                  <th className="px-6 py-4">Vigencia (meses)</th>
                  <th className="px-6 py-4">Max preguntas / asamblea</th>
                  <th className="px-6 py-4">Acta detallada</th>
                  <th className="px-6 py-4">Qué cubre</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {planes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No hay planes. Ejecuta <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">supabase/PLANES-TABLA-Y-SEED.sql</code> y <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">supabase/AGREGAR-LIMITES-PLANES.sql</code> en Supabase.
                    </td>
                  </tr>
                ) : (
                  planes.map((p) => {
                    const edit = editingPlan[p.key]
                    const maxPreg = edit?.max_preguntas_por_asamblea ?? p.max_preguntas_por_asamblea ?? 2
                    const actaDet = edit?.incluye_acta_detallada ?? p.incluye_acta_detallada ?? false
                    const queCubre = `${maxPreg} pregunta${maxPreg !== 1 ? 's' : ''}/asamblea · ${actaDet ? 'Acta con auditoría' : 'Sin acta detallada'}`
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{p.key}</td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={edit?.nombre ?? p.nombre}
                            onChange={(e) =>
                              setEditingPlan((prev) => ({
                                ...prev,
                                [p.key]: {
                                  ...(prev[p.key] ?? { nombre: p.nombre, precio_por_asamblea_cop: p.precio_por_asamblea_cop, tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10), vigencia_meses: p.vigencia_meses ?? (p.key === 'free' ? null : p.key === 'pilot' ? 3 : 12), max_preguntas_por_asamblea: p.max_preguntas_por_asamblea ?? 2, incluye_acta_detallada: p.incluye_acta_detallada ?? false }),
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
                            value={edit?.precio_por_asamblea_cop ?? p.precio_por_asamblea_cop}
                            onChange={(e) =>
                              setEditingPlan((prev) => ({
                                ...prev,
                                [p.key]: {
                                  ...(prev[p.key] ?? { nombre: p.nombre, precio_por_asamblea_cop: p.precio_por_asamblea_cop, tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10), vigencia_meses: p.vigencia_meses ?? (p.key === 'free' ? null : p.key === 'pilot' ? 3 : 12), max_preguntas_por_asamblea: p.max_preguntas_por_asamblea ?? 2, incluye_acta_detallada: p.incluye_acta_detallada ?? false }),
                                  precio_por_asamblea_cop: Number(e.target.value) || 0,
                                },
                              }))
                            }
                            className="w-full max-w-[100px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="px-6 py-4">
                          {p.key === 'pro' ? (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">Ilimitado</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={edit?.tokens_iniciales ?? p.tokens_iniciales ?? (p.key === 'free' ? 2 : 10)}
                              onChange={(e) =>
                                setEditingPlan((prev) => ({
                                  ...prev,
                                  [p.key]: {
...(prev[p.key] ?? { nombre: p.nombre, precio_por_asamblea_cop: p.precio_por_asamblea_cop, tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10), vigencia_meses: p.vigencia_meses ?? (p.key === 'free' ? null : p.key === 'pilot' ? 3 : 12), max_preguntas_por_asamblea: p.max_preguntas_por_asamblea ?? 2, incluye_acta_detallada: p.incluye_acta_detallada ?? false }),
                                  tokens_iniciales: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
                                  },
                                }))
                              }
                              className="w-full max-w-[80px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-white"
                              title="Tokens que se asignan al crear/cambiar a este plan"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {p.key === 'free' ? (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">—</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={edit?.vigencia_meses ?? p.vigencia_meses ?? (p.key === 'pilot' ? 3 : 12)}
                              onChange={(e) =>
                                setEditingPlan((prev) => ({
                                  ...prev,
                                  [p.key]: {
                                    ...(prev[p.key] ?? { nombre: p.nombre, precio_por_asamblea_cop: p.precio_por_asamblea_cop, tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10), vigencia_meses: p.vigencia_meses ?? (p.key === 'pilot' ? 3 : 12), max_preguntas_por_asamblea: p.max_preguntas_por_asamblea ?? 2, incluye_acta_detallada: p.incluye_acta_detallada ?? false }),
                                    vigencia_meses: e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
                                  },
                                }))
                              }
                              className="w-full max-w-[80px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-white"
                              title="Duración en meses al asignar este plan a una cuenta"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min={0}
                            value={edit?.max_preguntas_por_asamblea ?? p.max_preguntas_por_asamblea ?? 2}
                            onChange={(e) =>
                              setEditingPlan((prev) => ({
                                ...prev,
                                [p.key]: {
                                  ...(prev[p.key] ?? { nombre: p.nombre, precio_por_asamblea_cop: p.precio_por_asamblea_cop, tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10), vigencia_meses: p.vigencia_meses ?? (p.key === 'pilot' ? 3 : 12), max_preguntas_por_asamblea: p.max_preguntas_por_asamblea ?? 2, incluye_acta_detallada: p.incluye_acta_detallada ?? false }),
                                  max_preguntas_por_asamblea: Math.max(0, parseInt(e.target.value, 10) || 0),
                                },
                              }))
                            }
                            className="w-full max-w-[80px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-900 dark:text-white"
                            title="Máximo de preguntas de votación por asamblea; la app aplica este límite"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edit?.incluye_acta_detallada ?? p.incluye_acta_detallada ?? false}
                              onChange={(e) =>
                                setEditingPlan((prev) => ({
                                  ...prev,
                                [p.key]: {
                                  ...(prev[p.key] ?? { nombre: p.nombre, precio_por_asamblea_cop: p.precio_por_asamblea_cop, tokens_iniciales: p.tokens_iniciales ?? (p.key === 'pro' ? null : p.key === 'free' ? 2 : 10), vigencia_meses: p.vigencia_meses ?? (p.key === 'free' ? null : p.key === 'pilot' ? 3 : 12), max_preguntas_por_asamblea: p.max_preguntas_por_asamblea ?? 2, incluye_acta_detallada: p.incluye_acta_detallada ?? false }),
                                  incluye_acta_detallada: e.target.checked,
                                },
                                }))
                              }
                              className="rounded border-gray-300 dark:border-gray-600"
                              title="Si está marcado, el plan permite descargar acta con auditoría detallada"
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{edit?.incluye_acta_detallada ?? p.incluye_acta_detallada ? 'Sí' : 'No'}</span>
                          </label>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400 max-w-[180px]">
                          {queCubre}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSavePlan(p.key)}
                            disabled={savingPlanKey === p.key}
                            className="gap-1"
                            title="Guardar nombre, precio y límites de este plan"
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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen: total conjuntos y por plan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
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
          {PLAN_OPTIONS.map((opt) => (
            <div key={opt.value} className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <Gift className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Plan {opt.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{resumenPorPlan[opt.value] ?? 0}</p>
                </div>
              </div>
            </div>
          ))}
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

        {/* Carga masiva piloto */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Carga masiva de cuentas piloto</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sube un CSV con columna <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">organization_id</code> o <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">nombre</code>. Cada fila se asignará como plan Piloto (3 meses) con los tokens del plan Piloto.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setCargaMasivaFile(f ?? null)
                  setCargaMasivaResult(null)
                }}
                className="text-sm text-gray-600 dark:text-gray-400 file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-100 file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
              />
              <Button
                onClick={handleCargaMasivaPiloto}
                disabled={!cargaMasivaFile || cargaMasivaLoading}
                className="gap-2"
              >
                {cargaMasivaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Cargar CSV
              </Button>
            </div>
            {cargaMasivaResult && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 text-sm">
                <p className="font-medium text-gray-900 dark:text-white">
                  Exitosos: {cargaMasivaResult.exitosos} · Fallidos: {cargaMasivaResult.fallidos}
                </p>
                {cargaMasivaResult.resultados.filter((r) => !r.ok).length > 0 && (
                  <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-400 max-h-32 overflow-y-auto">
                    {cargaMasivaResult.resultados.filter((r) => !r.ok).map((r, idx) => (
                      <li key={idx}>Fila {r.fila}: {r.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conjuntos (cuentas) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cuentas (conjuntos)</h2>
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
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                title="Filtrar por plan actual"
              >
                <option value="all">Todos los planes</option>
                {PLAN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
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
                  <th className="px-6 py-4">Plan actual</th>
                  <th className="px-6 py-4">Estado suscripción</th>
                  <th className="px-6 py-4">Asignar plan</th>
                  <th className="px-6 py-4 text-right">Acción rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {conjuntosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {conjuntos.length === 0 ? 'No hay conjuntos registrados.' : 'Ningún conjunto coincide con el filtro.'}
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
                        <div className="flex items-center gap-2">
                          {c.plan_type === 'pro' ? (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">Ilimitado</span>
                          ) : (
                            <>
                              <input
                                type="number"
                                min={0}
                                value={tokensConjunto[c.id] ?? c.tokens_disponibles ?? 0}
                                onChange={(e) => setTokensConjunto((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white"
                                title="Tokens del conjunto (se descontan al crear o activar asambleas)"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updatingTokensId === c.id}
                                onClick={() => handleAplicarTokens(c.id)}
                              >
                                {updatingTokensId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {c.plan_status ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={planSelect[c.id] ?? c.plan_type}
                          onChange={(e) => setPlanSelect((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
                          title="Elegir el plan a asignar a este conjunto"
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
                          title="Activar Plan Pro por 1 año sin pago (cortesía o piloto)"
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
