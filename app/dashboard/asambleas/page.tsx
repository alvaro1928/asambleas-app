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
  ArchiveRestore,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'
import { Label } from '@/components/ui/label'

/** ISO UTC → valor para input datetime-local (hora local del navegador). */
function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Asamblea {
  id: string
  nombre: string
  descripcion?: string
  fecha: string
  estado: 'borrador' | 'activa' | 'finalizada'
  created_at: string
  is_demo?: boolean
  is_archived?: boolean
  organization_id?: string
  organization_name?: string
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
  const [tabOrigen, setTabOrigen] = useState<'mis' | 'soporte'>('mis')
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [asambleasSoporte, setAsambleasSoporte] = useState<Asamblea[]>([])
  const [cargandoSoporte, setCargandoSoporte] = useState(false)
  const [filtroConjuntoSoporte, setFiltroConjuntoSoporte] = useState<string>('all')

  /** Editar datos básicos desde la tarjeta (solo Mis asambleas) */
  const [asambleaToEdit, setAsambleaToEdit] = useState<Asamblea | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editFechaLocal, setEditFechaLocal] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Si la URL tiene ?demo=1, abrir el modal de sandbox (desde dashboard o enlace directo)
  useEffect(() => {
    if (searchParams.get('demo') === '1') {
      setShowWelcomeDemoModal(true)
      router.replace('/dashboard/asambleas', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    loadAsambleas()
    loadAsambleasSoporte()
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

      const ASAMBLEAS_COLUMNS =
        'id, nombre, descripcion, fecha, estado, created_at, is_demo, is_archived'

      const [{ data: org }, statusRes, { data: asambleasData, error }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', selectedConjuntoId).single(),
        fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(selectedConjuntoId)}`, {
          credentials: 'include',
        }),
        supabase
          .from('asambleas')
          .select(ASAMBLEAS_COLUMNS)
          .eq('organization_id', selectedConjuntoId)
          .order('fecha', { ascending: false }),
      ])

      if (org) {
        setConjuntoName(org.name)
      }

      const statusData = statusRes.ok ? await statusRes.json().catch(() => null) : null
      setTokensDisponibles(Math.max(0, Number(statusData?.tokens_disponibles ?? 0)))
      setCostoOperacion(Math.max(0, Number(statusData?.costo_operacion ?? 0)))

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

  const loadAsambleasSoporte = async () => {
    setCargandoSoporte(true)
    try {
      const res = await fetch('/api/super-admin/asambleas-disponibles', { credentials: 'include' })
      if (!res.ok) {
        setAsambleasSoporte([])
        return
      }
      const data = await res.json().catch(() => ({}))
      setAsambleasSoporte(Array.isArray(data?.asambleas) ? data.asambleas : [])
    } catch {
      setAsambleasSoporte([])
    } finally {
      setCargandoSoporte(false)
    }
  }

  const abrirAsambleaSoporte = (asamblea: Asamblea) => {
    if (!asamblea.organization_id) return
    localStorage.setItem('selectedConjuntoId', asamblea.organization_id)
    router.push(`/dashboard/asambleas/${asamblea.id}`)
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

  const puedeEliminarAsamblea = (a: Asamblea) =>
    a.is_demo === true
      ? true
      : a.estado === 'borrador' || a.estado === 'finalizada'

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

  const openEditModal = (e: React.MouseEvent, a: Asamblea) => {
    e.preventDefault()
    e.stopPropagation()
    setAsambleaToEdit(a)
    setEditNombre(a.nombre)
    setEditDescripcion(a.descripcion ?? '')
    setEditFechaLocal(isoToDatetimeLocalValue(a.fecha))
  }

  const resetEditForm = () => {
    setAsambleaToEdit(null)
    setEditNombre('')
    setEditDescripcion('')
    setEditFechaLocal('')
  }

  const closeEditModal = () => {
    if (savingEdit) return
    resetEditForm()
  }

  const handleSaveEditAsamblea = async () => {
    if (!asambleaToEdit) return
    const nombre = editNombre.trim()
    if (!nombre) {
      toast.error('El nombre es obligatorio')
      return
    }
    if (!editFechaLocal.trim()) {
      toast.error('Indica la fecha y hora de la asamblea')
      return
    }
    const d = new Date(editFechaLocal)
    if (Number.isNaN(d.getTime())) {
      toast.error('Fecha u hora no válida')
      return
    }
    const fechaIso = d.toISOString()
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('asambleas')
        .update({
          nombre,
          descripcion: editDescripcion.trim() || null,
          fecha: fechaIso,
        })
        .eq('id', asambleaToEdit.id)
      if (error) throw error
      setAsambleas((prev) =>
        prev.map((x) =>
          x.id === asambleaToEdit.id
            ? { ...x, nombre, descripcion: editDescripcion.trim() || undefined, fecha: fechaIso }
            : x
        )
      )
      resetEditForm()
      toast.success('Asamblea actualizada')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Error al guardar los cambios')
    } finally {
      setSavingEdit(false)
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

  const baseAsambleas = tabOrigen === 'soporte' ? asambleasSoporte : asambleas
  const conjuntosSoporte = Array.from(
    new Map(
      asambleasSoporte
        .filter((a) => a.organization_id)
        .map((a) => [
          a.organization_id as string,
          { id: a.organization_id as string, name: a.organization_name || 'Conjunto sin nombre' },
        ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const asambleasPorTab = baseAsambleas.filter((a) => {
    const searchTerm = searchNombre.trim().toLowerCase()
    const matchNombre =
      !searchTerm ||
      a.nombre.toLowerCase().includes(searchTerm) ||
      (tabOrigen === 'soporte' && (a.organization_name || '').toLowerCase().includes(searchTerm))
    const matchEstado = filterEstado === 'all' || a.estado === filterEstado
    const archived = a.is_archived === true
    const matchTab = tabArchivo === 'archivadas' ? archived : !archived
    const matchConjuntoSoporte =
      tabOrigen !== 'soporte' || filtroConjuntoSoporte === 'all' || a.organization_id === filtroConjuntoSoporte
    return matchNombre && matchEstado && matchTab && matchConjuntoSoporte
  })
  const asambleasFiltradas = asambleasPorTab

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 overflow-x-hidden">
      {/* Header — responsive: columna en móvil, fila en desktop */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Asambleas' }]} className="mb-2" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 shrink-0">
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Asambleas
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate max-w-full">
                  {tabOrigen === 'mis'
                    ? `${conjuntoName} • ${tabArchivo === 'activas' ? 'Activas' : 'Archivadas'}: ${asambleasFiltradas.length} asamblea${asambleasFiltradas.length !== 1 ? 's' : ''}`
                    : `Soporte Super Admin • ${tabArchivo === 'activas' ? 'Activas' : 'Archivadas'}: ${asambleasFiltradas.length} asamblea${asambleasFiltradas.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 px-3 py-2 border border-slate-200 dark:border-slate-600 min-w-0">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">Billetera:</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tokensDisponibles} tokens (créditos)</span>
                {costoOperacion > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">(costo: {costoOperacion})</span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 shrink-0"
                onClick={() => setShowWelcomeDemoModal(true)}
                title="Crear asamblea de demostración (entorno de pruebas) sin consumir tokens (créditos)"
              >
                <FlaskConical className="w-4 h-4 sm:mr-2 shrink-0" />
                <span className="hidden sm:inline">Probar en entorno de pruebas</span>
                <span className="sm:hidden">Pruebas</span>
              </Button>
              <Link href="/dashboard/asambleas/nueva" title="Crear una nueva asamblea para este conjunto" className="shrink-0">
                <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 w-full sm:w-auto" title="Crear una nueva asamblea para este conjunto">
                  <Plus className="w-4 h-4 sm:mr-2 shrink-0" />
                  <span className="hidden sm:inline">Nueva Asamblea</span>
                  <span className="sm:hidden">Nueva</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 overflow-x-hidden">
        <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setTabOrigen('mis')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tabOrigen === 'mis' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Mis asambleas
          </button>
          {asambleasSoporte.length > 0 && (
            <button
              type="button"
              onClick={() => setTabOrigen('soporte')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tabOrigen === 'soporte' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-b-2 border-amber-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              Soporte (Super Admin)
            </button>
          )}
        </div>
        {tabOrigen === 'soporte' && (
          <Alert className="mb-4 border-amber-300/70 bg-amber-50 dark:bg-amber-900/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Modo soporte</AlertTitle>
            <AlertDescription>
              Esta vista muestra asambleas de otros conjuntos para apoyo operativo. Se mantienen separadas de tus asambleas.
            </AlertDescription>
          </Alert>
        )}
        {baseAsambleas.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-4 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder={tabOrigen === 'soporte' ? 'Buscar por asamblea o conjunto...' : 'Buscar por nombre...'}
                  value={searchNombre}
                  onChange={(e) => setSearchNombre(e.target.value)}
                  className="pl-9"
                />
              </div>
              {tabOrigen === 'soporte' && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Conjunto:</span>
                  <select
                    value={filtroConjuntoSoporte}
                    onChange={(e) => setFiltroConjuntoSoporte(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 text-sm min-w-[180px]"
                    title="Filtrar por conjunto en modo soporte"
                  >
                    <option value="all">Todos</option>
                    {conjuntosSoporte.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
        {cargandoSoporte && tabOrigen === 'soporte' ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-12 text-center border border-gray-200 dark:border-gray-700 min-w-0">
            <p className="text-gray-600 dark:text-gray-400">Cargando asambleas de soporte...</p>
          </div>
        ) : baseAsambleas.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-12 text-center border border-gray-200 dark:border-gray-700 min-w-0">
            <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {tabOrigen === 'soporte' ? 'No hay asambleas disponibles en soporte' : 'No hay asambleas creadas'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {tabOrigen === 'soporte'
                ? 'Cuando existan asambleas en otros conjuntos aparecerán aquí para apoyo del super admin.'
                : 'Crea tu primera asamblea para comenzar a gestionar votaciones'}
            </p>
            {tabOrigen === 'mis' && (
              <Link href="/dashboard/asambleas/nueva" title="Crear tu primera asamblea">
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700" title="Crear tu primera asamblea">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Asamblea
                </Button>
              </Link>
            )}
          </div>
        ) : asambleasFiltradas.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-12 text-center border border-gray-200 dark:border-gray-700 min-w-0">
            <Archive className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
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
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-w-0 w-full">
            {asambleasFiltradas.map((asamblea) => {
              const counts = preguntasPorAsamblea[asamblea.id]
              const totalPreguntas = counts ? counts.abierta + counts.pendiente + counts.cerrada : 0
              const abiertas = counts?.abierta ?? 0
              const pendientes = counts?.pendiente ?? 0
              return (
              <Link
                key={asamblea.id}
                href={`/dashboard/asambleas/${asamblea.id}`}
                onClick={(e) => {
                  if (tabOrigen !== 'soporte') return
                  e.preventDefault()
                  abrirAsambleaSoporte(asamblea)
                }}
                className="group min-w-0"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-2xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer min-w-0 overflow-hidden">
                  {/* Header con estado */}
                  <div className="flex items-start justify-between mb-4 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {asamblea.nombre}
                        </h3>
                        {tabOrigen === 'mis' && (
                          <button
                            type="button"
                            onClick={(e) => openEditModal(e, asamblea)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shrink-0"
                            title="Editar nombre, descripción o fecha"
                          >
                            <Pencil className="w-4 h-4" aria-hidden />
                            <span className="sr-only">Editar datos de la asamblea</span>
                          </button>
                        )}
                        {tabOrigen === 'soporte' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                            {asamblea.organization_name || 'Conjunto'}
                          </span>
                        )}
                        {asamblea.is_demo === true && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700" title="Asamblea de demostración: verificación, delegado, colapsables y quórum como en una asamblea real">
                            <FlaskConical className="w-3 h-3 shrink-0" />
                            Pruebas
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tabArchivo === 'activas' && tabOrigen === 'mis' && (
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
                      {tabArchivo === 'archivadas' && tabOrigen === 'mis' && (
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
                      {puedeEliminarAsamblea(asamblea) && tabOrigen === 'mis' && (
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
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="w-full sm:flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteAsamblea}
              disabled={deleting || (confirmStep === 2 && confirmInput.trim() !== asambleaToDelete?.nombre.trim())}
              className="w-full sm:flex-1"
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

      {/* Editar datos básicos desde la lista */}
      <Dialog
        open={asambleaToEdit !== null}
        onOpenChange={(open) => {
          if (!open) closeEditModal()
        }}
      >
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Editar asamblea</DialogTitle>
            <DialogDescription>
              Corrige el nombre, la descripción o la fecha. Los cambios se verán en el panel, actas y mensajes que usen estos datos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="edit-asamblea-nombre">Nombre</Label>
              <Input
                id="edit-asamblea-nombre"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                placeholder="Ej. Asamblea ordinaria 2026"
                className="rounded-xl"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-asamblea-desc">Descripción (opcional)</Label>
              <textarea
                id="edit-asamblea-desc"
                value={editDescripcion}
                onChange={(e) => setEditDescripcion(e.target.value)}
                placeholder="Nota interna o contexto breve"
                rows={3}
                className="flex w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-asamblea-fecha">Fecha y hora</Label>
              <Input
                id="edit-asamblea-fecha"
                type="datetime-local"
                value={editFechaLocal}
                onChange={(e) => setEditFechaLocal(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={closeEditModal} disabled={savingEdit} className="w-full sm:flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSaveEditAsamblea} disabled={savingEdit} className="w-full sm:flex-1">
              {savingEdit ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block mr-2" />
                  Guardando…
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal bienvenida: asamblea de demostración (sandbox) */}
      <Dialog open={showWelcomeDemoModal} onOpenChange={setShowWelcomeDemoModal}>
        <DialogContent id="welcome-demo-modal" className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-amber-500" />
              Entorno de pruebas (sandbox)
            </DialogTitle>
            <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
              <p>
                Crea una asamblea de demostración con datos de ejemplo. <strong className="text-gray-700 dark:text-gray-300">No se consumen créditos (tokens)</strong> y podrás probar todas las funcionalidades antes de una asamblea real.
              </p>
              <p className="font-medium text-gray-700 dark:text-gray-300">Incluye las mismas funciones que una asamblea real:</p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-gray-600 dark:text-gray-400">
                <li>Centro de Control y página de Acceso (enlace, QR, envío por WhatsApp)</li>
                <li><strong>Verificación de asistencia</strong> (quórum por asistencia y por votación)</li>
                <li><strong>Acceso de asistente delegado</strong> (generar enlace para que otra persona vote por ti)</li>
                <li>Secciones <strong>colapsables</strong> en Acceso Público y en la página de Acceso</li>
                <li>Panel <strong>Quórum y Participación</strong> con tarjeta de asistencia verificada (incluso sin preguntas abiertas)</li>
                <li>Acta, gestión de poderes y reinicio de simulación</li>
              </ul>
              <p>
                Puedes usar <em>unidades de demostración</em> (10 cuentas de prueba). El cambio a <em>unidades reales</em> del conjunto está restringido a superadministrador.
              </p>
            </div>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowWelcomeDemoModal(false)}
              className="w-full sm:flex-1"
            >
              Ahora no
            </Button>
            <Button
              onClick={handleProbarDemo}
              disabled={creatingDemo}
              className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {creatingDemo ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block mr-2" />
                  Creando...
                </>
              ) : (
                'Crear entorno de pruebas'
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
