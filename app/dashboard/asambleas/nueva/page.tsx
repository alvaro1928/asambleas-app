'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Calendar, ShieldAlert, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ComprarTokensCTA } from '@/components/ComprarTokensCTA'

type OrganizationStatus = {
  tokens_disponibles: number
  unidades_conjunto: number
  costo_operacion: number
  puede_operar: boolean
}

export default function NuevaAsambleaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedConjuntoId, setSelectedConjuntoId] = useState<string | null>(null)
  const [status, setStatus] = useState<OrganizationStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [precioProCop, setPrecioProCop] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    fecha: '',
    hora: ''
  })

  useEffect(() => {
    const conjId = typeof window !== 'undefined' ? localStorage.getItem('selectedConjuntoId') : null
    setSelectedConjuntoId(conjId)

    if (!conjId) {
      setStatusLoading(false)
      setStatusError('No hay conjunto seleccionado')
      return
    }

    let cancelled = false
    setStatusLoading(true)
    setStatusError('')

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user?.id) setUserId(user.id)
    })

    Promise.all([
      fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(conjId)}`).then(async (res) => {
        if (!res.ok) {
          const code = res.status
          const data = await res.json().catch(() => ({}))
          const msg = code === 403 ? 'sin_acceso' : (data?.error || 'Error al cargar el estado')
          throw { code, message: msg }
        }
        return res.json()
      }),
      fetch('/api/configuracion-global').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/planes').then((r) => r.json()).catch(() => ({ planes: [] })),
    ])
      .then(([data, configData, planesData]) => {
        if (!cancelled) {
          setStatus({
            tokens_disponibles: Number(data.tokens_disponibles ?? 0),
            unidades_conjunto: Number(data.unidades_conjunto ?? 0),
            costo_operacion: Number(data.costo_operacion ?? 0),
            puede_operar: !!data.puede_operar,
          })
          setStatusError('')
          setStatusCode(null)
          if (configData?.precio_por_token_cop != null) setPrecioProCop(Number(configData.precio_por_token_cop))
          else {
            const pro = (planesData?.planes ?? []).find((p: { key: string }) => p.key === 'pro')
            if (pro?.precio_por_asamblea_cop != null) setPrecioProCop(Number(pro.precio_por_asamblea_cop))
          }
        }
      })
      .catch((err: { code?: number; message?: string } | Error) => {
        if (!cancelled) {
          const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : null
          const message = typeof err === 'object' && err !== null && 'message' in err ? (err as { message: string }).message : (err instanceof Error ? err.message : 'Error al cargar el estado del conjunto')
          setStatusCode(code ?? null)
          setStatusError(message)
        }
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const tokensDisponibles = status?.tokens_disponibles ?? 0
  const costoOperacion = status?.costo_operacion ?? 0
  const puedeOperar = status?.puede_operar ?? false
  const puedeCrear = !!status && !statusError
  const bloqueado = !statusLoading && !statusError && selectedConjuntoId && !puedeCrear

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const conjId = localStorage.getItem('selectedConjuntoId')
      if (!conjId) {
        setError('No hay conjunto seleccionado')
        setLoading(false)
        return
      }

      if (!formData.nombre.trim()) {
        setError('El nombre de la asamblea es obligatorio')
        setLoading(false)
        return
      }

      if (!formData.fecha) {
        setError('La fecha es obligatoria')
        setLoading(false)
        return
      }

      const fechaHora = formData.hora
        ? `${formData.fecha}T${formData.hora}:00`
        : `${formData.fecha}T10:00:00`

      const res = await fetch('/api/dashboard/crear-asamblea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: conjId,
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || null,
          fecha: fechaHora,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 402 && (data as { code?: string }).code === 'SIN_TOKENS') {
          setError('')
          setStatus((prev) => (prev ? { ...prev, tokens_disponibles: 0 } : null))
          return
        }
        if (res.status === 403) {
          setStatusCode(403)
          setStatusError('sin_acceso')
          setError('')
          return
        }
        throw new Error((data as { error?: string }).error || 'Error al crear la asamblea')
      }

      const asamblea = (data as { asamblea?: { id: string } }).asamblea
      if (asamblea?.id) {
        router.push(`/dashboard/asambleas/${asamblea.id}?success=created`)
      } else {
        setError('Error al crear la asamblea')
      }
    } catch (err: unknown) {
      console.error('Error creating asamblea:', err)
      setError(err instanceof Error ? err.message : 'Error al crear la asamblea')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard/asambleas"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Nueva Asamblea
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configura los datos básicos de la asamblea
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
          {/* Sin permiso (403): no es tema de tokens */}
          {!statusLoading && statusError && statusCode === 403 && (
            <div className="mb-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-10 h-10 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    No tienes permiso para este conjunto
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Tu usuario no está asociado a este conjunto. <strong>No es un tema de tokens</strong> — primero debes pertenecer al conjunto para crear asambleas.
                  </p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Elige otro conjunto en el selector del dashboard o pide al administrador que te agregue a este.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href="/dashboard">
                      <Button type="button" className="bg-indigo-600 hover:bg-indigo-700">
                        Ir al dashboard
                      </Button>
                    </Link>
                    <Link href="/dashboard/asambleas">
                      <Button type="button" variant="outline">
                        Volver a Asambleas
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Otro error al cargar */}
          {statusError && statusCode !== 403 && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{statusError}</AlertDescription>
            </Alert>
          )}
          {statusError && statusCode !== 403 && (
            <div className="mb-4">
              <Link href="/dashboard">
                <Button type="button" variant="outline">Ir al dashboard</Button>
              </Link>
            </div>
          )}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {statusLoading && (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              <span className="ml-3">Cargando estado del conjunto...</span>
            </div>
          )}

          {!statusLoading && bloqueado && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 px-4 py-3 border border-amber-200 dark:border-amber-800">
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  No hay suficientes tokens en tu billetera. Se descontan al activar votación, descargar acta o registrar votos manuales; compra más créditos.
                </p>
              </div>
              <ComprarTokensCTA
                conjuntoId={selectedConjuntoId}
                userId={userId}
                precioCop={precioProCop}
                planType="free"
                variant="blocked"
              />
              <div className="flex justify-center">
                <Link href="/dashboard/asambleas">
                  <Button type="button" variant="outline">
                    Volver a Asambleas
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {!statusLoading && !bloqueado && !statusError && selectedConjuntoId && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
              <Label htmlFor="nombre">
                Nombre de la Asamblea <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Asamblea Ordinaria 2026"
                className="mt-2"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Un nombre descriptivo para identificar la asamblea
              </p>
            </div>

            {/* Descripción */}
            <div>
              <Label htmlFor="descripcion">Descripción (Opcional)</Label>
              <textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Orden del día, temas a tratar, etc."
                className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={4}
              />
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fecha">
                  Fecha <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-2">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="fecha"
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="hora">Hora (Opcional)</Label>
                <Input
                  id="hora"
                  type="time"
                  value={formData.hora}
                  onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Información */}
            <Alert>
              <AlertDescription>
                La asamblea se creará en estado <strong>Borrador</strong>. Podrás agregar preguntas y activarla cuando estés listo.
              </AlertDescription>
            </Alert>

            {/* Botones */}
            <div className="flex space-x-4 pt-4">
              <Link href="/dashboard/asambleas" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Crear Asamblea
                  </>
                )}
              </Button>
            </div>
          </form>
          )}
        </div>
      </main>
    </div>
  )
}
