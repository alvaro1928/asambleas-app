'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  Calendar, 
  Users, 
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  Edit,
  Search,
  Trash2,
  AlertTriangle,
  Copy,
  FlaskConical,
  Archive,
  ArchiveRestore
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'

interface Asamblea {
  id: string
  nombre: string
  descripcion?: string
  fecha: string
  estado: 'borrador' | 'activa' | 'finalizada'
  created_at: string
  is_demo?: boolean
  is_archived?: boolean
}

interface PreguntasCount {
  abierta: number
  pendiente: number
  cerrada: number
}

function AsambleasPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])
  const [preguntasPorAsamblea, setPreguntasPorAsamblea] = useState<Record<string, PreguntasCount>>({})
  const [loading, setLoading] = useState(true)
  const [conjuntoName, setConjuntoName] = useState('')
  const [searchNombre, setSearchNombre] = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const [tokensDisponibles, setTokensDisponibles] = useState(0)
  const [costoOperacion, setCostoOperacion] = useState(0)

  // Eliminar asamblea (solo no activas) con doble validación
  const [asambleaToDelete, setAsambleaToDelete] = useState<Asamblea | null>(null)
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showWelcomeDemoModal, setShowWelcomeDemoModal] = useState(false)
  const [creatingDemo, setCreatingDemo] = useState(false)
  /** Tab: 'activas' | 'archivadas' */
  const [tabArchivo, setTabArchivo] = useState<'activas' | 'archivadas'>('activas')
  const [archivingId, setArchivingId] = useState<string | null>(null)

  // Si la URL tiene ?demo=1, abrir el modal de sandbox (desde dashboard o enlace directo)
  useEffect(() => {
    if (searchParams.get('demo') === '1') {
      setShowWelcomeDemoModal(true)
      router.replace('/dashboard/asambleas', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    loadAsambleas()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  const loadAsambleas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        router.push('/dashboard')
        return
      }

      // Obtener nombre del conjunto
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', selectedConjuntoId)
        .single()

      if (org) {
        setConjuntoName(org.name)
      }

      // Billetera de tokens (visible en todas las páginas de administrador)
      const statusRes = await fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(selectedConjuntoId)}`)
      const statusData = statusRes.ok ? await statusRes.json() : null
      setTokensDisponibles(Math.max(0, Number(statusData?.tokens_disponibles ?? 0)))
      setCostoOperacion(Math.max(0, Number(statusData?.costo_operacion ?? 0)))

      // Obtener asambleas del conjunto
      const { data: asambleasData, error } = await supabase
        .from('asambleas')
        .select('*')
        .eq('organization_id', selectedConjuntoId)
        .order('fecha', { ascending: false })

      if (error) {
        console.error('Error loading asambleas:', error)
        return
      }

      setAsambleas(asambleasData || [])
      if (!asambleasData?.length) setShowWelcomeDemoModal(true)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProbarDemo = async () => {
    // Si ya hay una asamblea demo en la lista, ir directo a ella
    const demoExistente = asambleas.find((a) => a.is_demo === true)
    if (demoExistente?.id) {
      setShowWelcomeDemoModal(false)
      router.push(`/dashboard/asambleas/${demoExistente.id}`)
      return
    }
    setCreatingDemo(true)
    try {
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      const res = await fetch('/api/dashboard/crear-asamblea-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organization_id: selectedConjuntoId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'Error al crear la asamblea de demostración')
        return
      }
      const id = data?.asamblea?.id
      if (id) {
        setShowWelcomeDemoModal(false)
        router.push(`/dashboard/asambleas/${id}`)
      }
    } finally {
      setCreatingDemo(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges = {
      borrador: {
        icon: Edit,
        text: 'Borrador',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      },
      activa: {
        icon: CheckCircle2,
        text: 'Activa',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      },
      finalizada: {
        icon: Clock,
        text: 'Finalizada',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      }
    }

    const badge = badges[estado as keyof typeof badges]
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    )
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const puedeEliminarAsamblea = (a: Asamblea) => a.estado === 'borrador' || a.estado === 'finalizada'

  const openDeleteModal = (e: React.MouseEvent, a: Asamblea) => {
    e.preventDefault()
    e.stopPropagation()
    if (!puedeEliminarAsamblea(a)) return
    setAsambleaToDelete(a)
    setConfirmStep(1)
    setConfirmInput('')
  }

  const closeDeleteModal = () => {
    if (!deleting) {
      setAsambleaToDelete(null)
      setConfirmStep(1)
      setConfirmInput('')
    }
  }

  const handleConfirmDeleteAsamblea = async () => {
    if (!asambleaToDelete) return
    if (confirmStep === 1) {
      setConfirmStep(2)
      return
    }
    if (confirmInput.trim() !== asambleaToDelete.nombre.trim()) return
    setDeleting(true)
    try {
      const res = await fetch('/api/dashboard/eliminar-asamblea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asambleaToDelete.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'Error al eliminar la asamblea')
        return
      }
      setAsambleas((prev) => prev.filter((a) => a.id !== asambleaToDelete.id))
      closeDeleteModal()
      toast.success('Asamblea eliminada correctamente')
    } finally {
      setDeleting(false)
    }
  }

  const handleArchivarAsamblea = async (e: React.MouseEvent, a: Asamblea) => {
    e.preventDefault()
    e.stopPropagation()
    setArchivingId(a.id)
    try {
      const { error } = await supabase.from('asambleas').update({ is_archived: true }).eq('id', a.id)
      if (error) throw error
      setAsambleas((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_archived: true } : x)))
      toast.success('La asamblea se movió al historial. Podrás recuperarla cuando quieras.')
    } catch (err) {
      console.error(err)
      toast.error('Error al archivar la asamblea')
    } finally {
      setArchivingId(null)
    }
  }

  const handleDesarchivarAsamblea = async (e: React.MouseEvent, a: Asamblea) => {
    e.preventDefault()
    e.stopPropagation()
    setArchivingId(a.id)
    try {
      const { error } = await supabase.from('asambleas').update({ is_archived: false }).eq('id', a.id)
      if (error) throw error
      setAsambleas((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_archived: false } : x)))
      toast.success('Asamblea restaurada a la lista principal.')
    } catch (err) {
      console.error(err)
      toast.error('Error al desarchivar la asamblea')
    } finally {
      setArchivingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando asambleas...</p>
        </div>
      </div>
    )
  }

  const asambleasPorTab = asambleas.filter((a) => {
    const matchNombre = !searchNombre.trim() || a.nombre.toLowerCase().includes(searchNombre.trim().toLowerCase())
    const matchEstado = filterEstado === 'all' || a.estado === filterEstado
    const archived = a.is_archived === true
    const matchTab = tabArchivo === 'archivadas' ? archived : !archived
    return matchNombre && matchEstado && matchTab
  })
  const asambleasFiltradas = asambleasPorTab

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Asambleas' }]} className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Asambleas
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {conjuntoName} • {tabArchivo === 'activas' ? 'Activas' : 'Archivadas'}: {asambleasFiltradas.length} asamblea{asambleasFiltradas.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 px-3 py-2 border border-slate-200 dark:border-slate-600">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Billetera:</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tokensDisponibles} tokens</span>
                {costoOperacion > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">(costo al activar: {costoOperacion})</span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                onClick={() => setShowWelcomeDemoModal(true)}
                title="Crear asamblea de demostración (sandbox) sin consumir tokens"
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                Probar en sandbox
              </Button>
              <Link href="/dashboard/asambleas/nueva" title="Crear una nueva asamblea para este conjunto">
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700" title="Crear una nueva asamblea para este conjunto">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Asamblea
              </Button>
            </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {asambleas.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Buscar por nombre..."
                  value={searchNombre}
                  onChange={(e) => setSearchNombre(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Estado:</span>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 text-sm min-w-[140px]"
                  title="Filtrar por estado de la asamblea"
                >
                  <option value="all">Todas</option>
                  <option value="borrador">Borrador</option>
                  <option value="activa">Activa</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setTabArchivo('activas')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tabArchivo === 'activas' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                Activas
              </button>
              <button
                type="button"
                onClick={() => setTabArchivo('archivadas')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tabArchivo === 'archivadas' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b-2 border-slate-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                Archivadas
              </button>
            </div>
          </>
        )}
        {asambleas.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No hay asambleas creadas
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Crea tu primera asamblea para comenzar a gestionar votaciones
            </p>
            <Link href="/dashboard/asambleas/nueva" title="Crear tu primera asamblea">
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700" title="Crear tu primera asamblea">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Asamblea
              </Button>
            </Link>
          </div>
        ) : asambleasFiltradas.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {tabArchivo === 'archivadas' ? 'No hay asambleas archivadas' : 'No hay asambleas en esta vista'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {tabArchivo === 'archivadas' ? 'Las asambleas que archives aparecerán aquí. Puedes desarchivarlas cuando quieras.' : 'Usa el filtro o cambia a la pestaña Archivadas.'}
            </p>
            {tabArchivo === 'archivadas' && (
              <Button variant="outline" onClick={() => setTabArchivo('activas')}>
                Ver activas
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {asambleasFiltradas.map((asamblea) => {
              const counts = preguntasPorAsamblea[asamblea.id]
              const totalPreguntas = counts ? counts.abierta + counts.pendiente + counts.cerrada : 0
              const abiertas = counts?.abierta ?? 0
              const pendientes = counts?.pendiente ?? 0
              return (
              <Link
                key={asamblea.id}
                href={`/dashboard/asambleas/${asamblea.id}`}
                className="group"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-2xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer">
                  {/* Header con estado */}
                  <div className="flex items-start justify-between mb-4 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {asamblea.nombre}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tabArchivo === 'activas' && (
                        <button
                          type="button"
                          onClick={(e) => handleArchivarAsamblea(e, asamblea)}
                          disabled={archivingId === asamblea.id}
                          className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                          title="La asamblea se moverá al historial. Podrás recuperarla cuando quieras."
                        >
                          {archivingId === asamblea.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {tabArchivo === 'archivadas' && (
                        <button
                          type="button"
                          onClick={(e) => handleDesarchivarAsamblea(e, asamblea)}
                          disabled={archivingId === asamblea.id}
                          className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          title="Devolver a la lista principal"
                        >
                          {archivingId === asamblea.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ArchiveRestore className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {puedeEliminarAsamblea(asamblea) && (
                        <button
                          type="button"
                          onClick={(e) => openDeleteModal(e, asamblea)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Eliminar asamblea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {getEstadoBadge(asamblea.estado)}
                    </div>
                  </div>

                  {/* Descripción */}
                  {asamblea.descripcion && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {asamblea.descripcion}
                    </p>
                  )}

                  {/* Fecha */}
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatFecha(asamblea.fecha)}
                  </div>

                  {/* ID (copiar) */}
                  <div
                    className="flex items-center gap-1.5 text-xs font-mono text-gray-400 dark:text-gray-500 mb-4 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      navigator.clipboard.writeText(asamblea.id)
                      toast.success('ID copiado')
                    }}
                    title={`ID: ${asamblea.id} (clic para copiar)`}
                  >
                    <Copy className="w-3 h-3 shrink-0" />
                    <span className="truncate">{asamblea.id}</span>
                  </div>

                  {/* Progreso preguntas */}
                  {totalPreguntas > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      {abiertas > 0 && <span className="text-green-600 dark:text-green-400">{abiertas} abierta{abiertas !== 1 ? 's' : ''}</span>}
                      {abiertas > 0 && (pendientes > 0 || counts?.cerrada) && ' • '}
                      {pendientes > 0 && <span>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
                      {pendientes > 0 && counts?.cerrada ? ' • ' : ''}
                      {counts?.cerrada ? <span>{counts.cerrada} cerrada{counts.cerrada !== 1 ? 's' : ''}</span> : null}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <FileText className="w-4 h-4 mr-1" />
                        Ver detalles
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )})}
          </div>
        )}
      </main>

      {/* Modal doble validación: eliminar asamblea (solo no activas) */}
      <Dialog open={asambleaToDelete !== null} onOpenChange={(open) => !open && closeDeleteModal()}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {confirmStep === 1 ? '¿Eliminar esta asamblea?' : 'Confirmar eliminación'}
            </DialogTitle>
            <DialogDescription>
              {asambleaToDelete && confirmStep === 1 && (
                <span>
                  La asamblea <strong>«{asambleaToDelete.nombre}»</strong> se eliminará de forma permanente junto con todas sus preguntas y votos. Esta acción no se puede deshacer.
                </span>
              )}
              {asambleaToDelete && confirmStep === 2 && (
                <span>
                  Escribe el nombre de la asamblea exactamente como aparece para confirmar:
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {confirmStep === 2 && asambleaToDelete && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nombre a escribir: <strong className="text-gray-900 dark:text-white">«{asambleaToDelete.nombre}»</strong>
              </p>
              <Input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Escribe el nombre aquí"
                className="rounded-xl"
                autoFocus
              />
            </div>
          )}
          {confirmStep === 1 && (
            <Alert variant="warning" className="my-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Advertencia</AlertTitle>
              <AlertDescription>
                Esta acción no se puede deshacer. Se eliminarán todas las preguntas, votos y datos asociados.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteAsamblea}
              disabled={deleting || (confirmStep === 2 && confirmInput.trim() !== asambleaToDelete?.nombre.trim())}
              className="flex-1"
            >
              {deleting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block mr-2" />
                  Eliminando...
                </>
              ) : confirmStep === 1 ? (
                'Continuar'
              ) : (
                'Confirmar eliminación'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal bienvenida: asamblea de demostración cuando no hay asambleas */}
      <Dialog open={showWelcomeDemoModal} onOpenChange={setShowWelcomeDemoModal}>
        <DialogContent id="welcome-demo-modal" className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bienvenido a Votaciones de Asambleas Online</DialogTitle>
            <DialogDescription>
              ¿Deseas explorar con una simulación? Crearemos una asamblea de demostración con datos de ejemplo. No se consumen créditos y podrás practicar el Centro de Control, el enlace de votación y el acta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowWelcomeDemoModal(false)}
              className="flex-1"
            >
              Crear asamblea real
            </Button>
            <Button
              onClick={handleProbarDemo}
              disabled={creatingDemo}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {creatingDemo ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block mr-2" />
                  Creando...
                </>
              ) : (
                'Probar ahora'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AsambleasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando asambleas...</p>
        </div>
      </div>
    }>
      <AsambleasPageContent />
    </Suspense>
  )
}
