'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import ConjuntoSelector from '@/components/ConjuntoSelector'
import { ComprarTokensCTA } from '@/components/ComprarTokensCTA'
import { Tooltip as UiTooltip } from '@/components/ui/tooltip'
import { isAdminEmail } from '@/lib/super-admin'
import { useToast } from '@/components/providers/ToastProvider'

interface UnidadMetrics {
  total: number
  sumaCoeficientes: number
  censoDatos: number
}

export default function DashboardPage() {
  const toast = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [conjuntosCount, setConjuntosCount] = useState(0)
  const [unidadesCount, setUnidadesCount] = useState(0)
  const [metrics, setMetrics] = useState<UnidadMetrics>({
    total: 0,
    sumaCoeficientes: 0,
    censoDatos: 0
  })
  const [tokensDisponibles, setTokensDisponibles] = useState<number>(0)
  const [costoOperacion, setCostoOperacion] = useState<number>(0)
  const [precioProCop, setPrecioProCop] = useState<number | null>(null)
  const [selectedConjuntoId, setSelectedConjuntoId] = useState<string | null>(null)
  const router = useRouter()

  const formatPrecioCop = (cop: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cop)

  useEffect(() => {
    checkUser()

    // Verificar mensaje de éxito desde URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const success = params.get('success')
      if (success === 'conjunto-creado') {
        setSuccessMessage('¡Conjunto registrado exitosamente! Ahora puedes comenzar a gestionarlo.')
        setTimeout(() => setSuccessMessage(''), 5000)
        window.history.replaceState({}, '', '/dashboard')
      } else if (success === 'unidades-importadas') {
        setSuccessMessage('¡Unidades importadas exitosamente! Tu base de datos de copropiedad está lista.')
        setTimeout(() => setSuccessMessage(''), 5000)
        window.history.replaceState({}, '', '/dashboard')
      }
    }

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          loadStats(session.user.id)
        } else {
          router.push('/login')
        }
      }
    )

    // Escuchar cambios en localStorage (cuando se cambia de conjunto)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedConjuntoId' && user) {
        loadStats(user.id)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('storage', handleStorageChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      await loadStats(user.id)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const loadPrecioPro = async () => {
    try {
      const configRes = await fetch('/api/configuracion-global')
      const configData = (await configRes.json()) as { precio_por_token_cop?: number | null }
      if (configData?.precio_por_token_cop != null) {
        setPrecioProCop(Number(configData.precio_por_token_cop))
        return
      }
      const res = await fetch('/api/planes')
      const data = (await res.json()) as { planes?: Array<{ key: string; precio_por_asamblea_cop?: number }> }
      const pro = data?.planes?.find(p => p.key === 'pro')
      if (pro != null && typeof pro.precio_por_asamblea_cop === 'number') {
        setPrecioProCop(pro.precio_por_asamblea_cop)
      }
    } catch {
      // ignorar
    }
  }

  const loadStats = async (userId: string) => {
    try {
      loadPrecioPro()
      // Contar conjuntos del usuario
      const { data: profiles } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', userId)

      const uniqueOrgs = new Set(profiles?.map(p => p.organization_id).filter(Boolean))
      setConjuntosCount(uniqueOrgs.size)

      // Conjunto activo: tokens del gestor (billetera) y costo para este conjunto (1 token = 1 unidad)
      const conjId = localStorage.getItem('selectedConjuntoId')
      setSelectedConjuntoId(conjId)
      if (!conjId) setTokensDisponibles(0)

      if (conjId) {
        const statusRes = await fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(conjId)}`, { credentials: 'include' })
        const statusData = statusRes.ok ? await statusRes.json().catch(() => ({})) : null
        setTokensDisponibles(Math.max(0, Number(statusData?.tokens_disponibles ?? 0)))
        const unidades = Math.max(0, Number(statusData?.unidades_conjunto ?? 0))
        setUnidadesCount(unidades)
        setCostoOperacion(Math.max(0, Number(statusData?.costo_operacion ?? unidades)))

        const { data: unidadesData, error } = await supabase
          .from('unidades')
          .select('*')
          .eq('organization_id', conjId)

        if (!error && unidadesData) {
          const total = unidadesData.length
          setUnidadesCount(total)

          // Calcular suma de coeficientes
          const sumaCoeficientes = unidadesData.reduce((sum, u) => sum + u.coeficiente, 0)

          // Calcular censo de datos (unidades con email Y teléfono)
          const unidadesCompletas = unidadesData.filter(
            u => u.email_propietario && u.telefono_propietario
          ).length
          const censoDatos = total > 0 ? (unidadesCompletas / total) * 100 : 0

          setMetrics({
            total,
            sumaCoeficientes,
            censoDatos
          })
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSignOut = async () => {
    // Cerrar sesión solo en el servidor para no borrar el code_verifier de PKCE
    // (evita "PKCE code verifier not found" al volver a entrar con Google)
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-soft border-b border-slate-200 dark:border-gray-700 rounded-b-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Asambleas App
            </h1>
            <div className="flex items-center space-x-4">
              <ConjuntoSelector />
              {selectedConjuntoId && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 px-3 py-2 border border-slate-200 dark:border-slate-600">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Billetera:
                  </span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {tokensDisponibles} tokens
                  </span>
                  {costoOperacion > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      (costo por operación: {costoOperacion})
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center space-x-3">
              {user?.email && isAdminEmail(user.email) && (
                <UiTooltip content="Panel de super administrador: conjuntos, créditos y configuración">
                  <a
                    href="/super-admin"
                    onClick={(e) => {
                      e.preventDefault()
                      window.location.href = '/super-admin'
                    }}
                    className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors inline-flex items-center space-x-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Administración</span>
                  </a>
                </UiTooltip>
              )}
              <UiTooltip content="Cambiar contraseña, preferencias y datos de tu cuenta">
                <Link
                  href="/dashboard/configuracion"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors inline-flex items-center space-x-2"
                >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>Configuración</span>
              </Link>
              </UiTooltip>
              <UiTooltip content="Cerrar sesión y volver a la pantalla de inicio">
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cerrar sesión
                </button>
              </UiTooltip>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 animate-fade-in">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                  {successMessage}
                </p>
              </div>
            </div>
          )}

          {/* Banner: sin tokens o pocos tokens (estilo apps de IA) */}
          {selectedConjuntoId && tokensDisponibles < costoOperacion && costoOperacion > 0 && (
            <ComprarTokensCTA
              conjuntoId={selectedConjuntoId}
              userId={user?.id ?? undefined}
              precioCop={precioProCop}
              variant={tokensDisponibles === 0 ? 'blocked' : 'low'}
            />
          )}

          {/* Welcome Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  ¡Bienvenido!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  {user?.email}
                </p>
                <p className="text-gray-500 dark:text-gray-500 mt-1">
                  Estás listo para gestionar tus asambleas
                </p>
              </div>
            </div>
          </div>

          {/* Billetera de tokens */}
          {selectedConjuntoId && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1M11 14l2 2 4-4" />
                </svg>
                Billetera de tokens
              </h3>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 dark:text-gray-400">Saldo:</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {tokensDisponibles} tokens
                  </span>
                  {costoOperacion > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      (1 token = 1 unidad; costo por operación: {costoOperacion})
                    </span>
                  )}
                </div>
              </div>
              {costoOperacion > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Activar votación, descargar acta con auditoría y registro manual consumen <strong>{costoOperacion} tokens</strong>. Compra más si tu billetera tiene menos.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Compra tokens ({formatPrecioCop(precioProCop ?? 0)}/token). Nuevos gestores reciben 50 tokens de regalo.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                <svg
                  className="w-10 h-10 text-indigo-600 dark:text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Comienza ahora
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Crea tu primer conjunto residencial y empieza a gestionar tus asambleas
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <UiTooltip content="Crear un nuevo conjunto residencial para gestionar sus asambleas y unidades">
                  <Link
                    href="/dashboard/nuevo-conjunto"
                    className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Registrar Conjunto</span>
                  </Link>
                </UiTooltip>
                <UiTooltip content="Cargar unidades desde Excel o CSV con coeficientes y datos de propietarios">
                  <Link
                    href="/dashboard/unidades/importar"
                    className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span>Importar Unidades</span>
                  </Link>
                </UiTooltip>
                <UiTooltip content="Ver y crear asambleas, preguntas y votaciones del conjunto">
                  <Link
                    href="/dashboard/asambleas"
                    className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span>Asambleas</span>
                  </Link>
                </UiTooltip>
              </div>
            </div>
          </div>

          {/* Métricas Detalladas — grid uniforme: misma altura y alineación */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* Total Unidades */}
            <div className="h-full min-h-[220px]">
              <UiTooltip content="Ver listado de unidades, editar y gestionar coeficientes">
                <Link href="/dashboard/unidades" className="block h-full">
                  <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-green-300 dark:hover:border-green-700 transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.total}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mt-auto">
                      Total Unidades • Clic para gestionar
                    </p>
                  </div>
                </Link>
              </UiTooltip>
            </div>

            {/* Suma Coeficientes */}
            <div className="h-full min-h-[220px]">
              <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700" title="La Ley 675 exige que la suma de coeficientes sea 100%. Verde = correcto.">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    Math.abs(metrics.sumaCoeficientes - 100) < 0.000001 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    <svg className={`w-6 h-6 ${Math.abs(metrics.sumaCoeficientes - 100) < 0.000001 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {Math.abs(metrics.sumaCoeficientes - 100) < 0.000001 ? (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.sumaCoeficientes.toFixed(2)}%</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mt-auto">Suma Coeficientes (Ley 675)</p>
              </div>
            </div>

            {/* Censo de Datos */}
            <div className="h-full min-h-[220px]">
              <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700" title="Porcentaje de unidades con email y teléfono completos para contacto.">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.censoDatos.toFixed(0)}%</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Datos de Contacto Completos</p>
                <div className="mt-auto pt-3">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${metrics.censoDatos}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Conjuntos Registrados */}
            <div className="h-full min-h-[220px]">
              <UiTooltip content="Ver y editar los conjuntos residenciales que gestionas">
                <Link href="/dashboard/conjuntos" className="block h-full">
                  <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{conjuntosCount}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mt-auto">Conjuntos Registrados</p>
                  </div>
                </Link>
              </UiTooltip>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
