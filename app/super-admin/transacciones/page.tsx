'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Shield, ArrowLeft, Loader2, Receipt, DollarSign, Search, FileDown, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

interface TransaccionRow {
  id: string
  organization_id: string
  organization_name: string
  monto_centavos: number
  wompi_transaction_id: string | null
  estado: string
  created_at: string
}

interface OrganizacionOption {
  id: string
  name: string
}

export default function SuperAdminTransaccionesPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [transacciones, setTransacciones] = useState<TransaccionRow[]>([])
  const [organizaciones, setOrganizaciones] = useState<OrganizacionOption[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [estado, setEstado] = useState('todos')
  const [conjuntoId, setConjuntoId] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const loadData = useCallback(
    async (filtros?: { fechaDesde: string; fechaHasta: string; estado: string; conjuntoId: string; busqueda: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        router.replace('/login?redirect=/super-admin/transacciones')
        return
      }
      const f = filtros ?? { fechaDesde, fechaHasta, estado, conjuntoId, busqueda }
      const params = new URLSearchParams()
      if (f.fechaDesde) params.set('fecha_desde', f.fechaDesde)
      if (f.fechaHasta) params.set('fecha_hasta', f.fechaHasta)
      if (f.estado && f.estado !== 'todos') params.set('estado', f.estado)
      if (f.conjuntoId && f.conjuntoId !== 'todos') params.set('conjunto_id', f.conjuntoId)
      if (f.busqueda.trim()) params.set('busqueda', f.busqueda.trim())

      const res = await fetch(`/api/super-admin/transacciones?${params.toString()}`, { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        router.replace('/login?redirect=/super-admin/transacciones')
        setLoading(false)
        return
      }
      if (!res.ok) {
        toast.error('Error al cargar transacciones')
        setLoading(false)
        return
      }
      const data = await res.json()
      setTransacciones(data.transacciones ?? [])
      setOrganizaciones(data.organizaciones ?? [])
      setSelectedIds(new Set())
      setLoading(false)
    },
    [router, fechaDesde, fechaHasta, estado, conjuntoId, busqueda, toast]
  )

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo carga inicial
  }, [])

  const handleAplicarFiltros = () => {
    setLoading(true)
    loadData({ fechaDesde, fechaHasta, estado, conjuntoId, busqueda })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === transacciones.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transacciones.map((t) => t.id)))
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

  const formatFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  const formatFechaCSV = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-CO')
    } catch {
      return iso
    }
  }

  const estadoBadge = (estadoVal: string) => {
    const s = (estadoVal || '').toUpperCase()
    if (s === 'APPROVED') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    if (s === 'PENDING') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }

  const exportarSeleccion = () => {
    const toExport = selectedIds.size > 0
      ? transacciones.filter((t) => selectedIds.has(t.id))
      : transacciones
    if (toExport.length === 0) {
      toast.error('No hay transacciones para exportar')
      return
    }
    const headers = ['Fecha', 'Conjunto', 'Monto (COP)', 'Estado', 'ID Wompi']
    const rows = toExport.map((t) => [
      formatFechaCSV(t.created_at),
      `"${(t.organization_name || '').replace(/"/g, '""')}"`,
      String(t.monto_centavos / 100),
      t.estado,
      t.wompi_transaction_id ?? '',
    ])
    const csv = ['\ufeff' + headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transacciones_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(toExport.length === transacciones.length ? 'Exportadas todas las transacciones mostradas' : `Exportadas ${toExport.length} transacción(es)`)
  }

  if (loading && transacciones.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando transacciones...</p>
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
                Transacciones y pagos
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Historial de pagos registrados (Wompi / tokens)
              </p>
            </div>
          </div>
          <Link href="/super-admin">
            <Button variant="outline" className="gap-2" title="Volver a Super Administración">
              <ArrowLeft className="w-4 h-4" />
              Volver a Administración
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Filtros
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desde (fecha)</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasta (fecha)</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white text-sm"
              >
                <option value="todos">Todos</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="DECLINED">DECLINED</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conjunto (cuenta)</label>
              <select
                value={conjuntoId}
                onChange={(e) => setConjuntoId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white text-sm"
              >
                <option value="todos">Todos</option>
                {organizaciones.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar por conjunto</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre conjunto..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleAplicarFiltros} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
              Aplicar filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFechaDesde('')
                setFechaHasta('')
                setEstado('todos')
                setConjuntoId('todos')
                setBusqueda('')
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>

        {/* Tabla y exportar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Transacciones {transacciones.length > 0 && `(${transacciones.length})`}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="gap-1"
                title={selectedIds.size === transacciones.length ? 'Quitar selección' : 'Seleccionar todas'}
              >
                {selectedIds.size === transacciones.length && transacciones.length > 0 ? 'Quitar todas' : 'Seleccionar todas'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportarSeleccion}
                className="gap-2"
                title={selectedIds.size > 0 ? `Exportar ${selectedIds.size} seleccionadas` : 'Exportar todas las mostradas'}
              >
                <FileDown className="w-4 h-4" />
                {selectedIds.size > 0 ? `Exportar (${selectedIds.size})` : 'Exportar todas'}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {transacciones.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay transacciones con los filtros aplicados.</p>
                <p className="text-sm mt-2">Ajusta los filtros o limpia para ver todo.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={transacciones.length > 0 && selectedIds.size === transacciones.length}
                        onChange={selectAll}
                        className="rounded border-gray-300 dark:border-gray-600"
                        title="Seleccionar todas"
                      />
                    </th>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Conjunto</th>
                    <th className="px-6 py-4">Monto</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">ID Wompi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {transacciones.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                          title="Seleccionar para exportar"
                        />
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatFecha(t.created_at)}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {t.organization_name}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                        {formatDinero(t.monto_centavos)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoBadge(t.estado)}`}
                        >
                          {t.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-[180px]" title={t.wompi_transaction_id ?? ''}>
                        {t.wompi_transaction_id ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
