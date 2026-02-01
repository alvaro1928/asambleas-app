'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Asamblea {
  id: string
  nombre: string
  descripcion?: string
  fecha: string
  estado: 'borrador' | 'activa' | 'finalizada'
  created_at: string
}

interface PreguntasCount {
  abierta: number
  pendiente: number
  cerrada: number
}

export default function AsambleasPage() {
  const router = useRouter()
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])
  const [preguntasPorAsamblea, setPreguntasPorAsamblea] = useState<Record<string, PreguntasCount>>({})
  const [loading, setLoading] = useState(true)
  const [conjuntoName, setConjuntoName] = useState('')
  const [searchNombre, setSearchNombre] = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const [tokensDisponibles, setTokensDisponibles] = useState(0)
  const [costoOperacion, setCostoOperacion] = useState(0)

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
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
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

  const asambleasFiltradas = asambleas.filter((a) => {
    const matchNombre = !searchNombre.trim() || a.nombre.toLowerCase().includes(searchNombre.trim().toLowerCase())
    const matchEstado = filterEstado === 'all' || a.estado === filterEstado
    return matchNombre && matchEstado
  })

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
                  {conjuntoName} • {asambleasFiltradas.length} asamblea{asambleasFiltradas.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 px-3 py-2 border border-slate-200 dark:border-slate-600">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Billetera:</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tokensDisponibles} tokens</span>
                {costoOperacion > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">(costo/op: {costoOperacion})</span>
                )}
              </div>
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
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 text-sm min-w-[160px]"
            >
              <option value="all">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="activa">Activa</option>
              <option value="finalizada">Finalizada</option>
            </select>
          </div>
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
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {asamblea.nombre}
                      </h3>
                    </div>
                    {getEstadoBadge(asamblea.estado)}
                  </div>

                  {/* Descripción */}
                  {asamblea.descripcion && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {asamblea.descripcion}
                    </p>
                  )}

                  {/* Fecha */}
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatFecha(asamblea.fecha)}
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
    </div>
  )
}
