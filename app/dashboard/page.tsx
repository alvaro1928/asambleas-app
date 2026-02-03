'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Wallet, Plus, Lock, HelpCircle } from 'lucide-react'
import ConjuntoSelector from '@/components/ConjuntoSelector'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const [colorPrincipalHex, setColorPrincipalHex] = useState<string>('#4f46e5')
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null)
  const [selectedConjuntoId, setSelectedConjuntoId] = useState<string | null>(null)
  const [guiaModalOpen, setGuiaModalOpen] = useState(false)
  const [modalCompraOpen, setModalCompraOpen] = useState(false)
  const [compraRapida, setCompraRapida] = useState(true)
  const [cantidadManual, setCantidadManual] = useState<number>(20)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
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
      const pago = params.get('pago')
      if (pago === 'ok') {
        setSuccessMessage('Pago realizado. Tus tokens se acreditarán en unos segundos.')
        setTimeout(() => setSuccessMessage(''), 8000)
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

  const loadConfig = async () => {
    try {
      const configRes = await fetch('/api/configuracion-global')
      const configData = (await configRes.json()) as { precio_por_token_cop?: number | null; color_principal_hex?: string | null; whatsapp_number?: string | null }
      if (configData?.precio_por_token_cop != null) setPrecioProCop(Number(configData.precio_por_token_cop))
      if (configData?.color_principal_hex && /^#[0-9A-Fa-f]{6}$/.test(configData.color_principal_hex)) setColorPrincipalHex(configData.color_principal_hex)
      if (configData?.whatsapp_number != null && typeof configData.whatsapp_number === 'string') setWhatsappNumber(configData.whatsapp_number)
    } catch {
      // ignorar
    }
  }

  const loadStats = async (userId: string) => {
    try {
      loadConfig()
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

          setMetrics({
            total,
            sumaCoeficientes,
            censoDatos: 0
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0E14' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
          <p className="mt-4 text-slate-400">Cargando...</p>
        </div>
      </div>
    )
  }

  const MIN_TOKENS_COMPRA = 20
  const cantidadCompra = compraRapida ? Math.max(MIN_TOKENS_COMPRA, costoOperacion) : Math.max(MIN_TOKENS_COMPRA, cantidadManual)
  const totalPagarCop = (precioProCop ?? 0) * cantidadCompra
  const puedePagar = !!user?.id
  const tokensInsuficientes = selectedConjuntoId && costoOperacion > 0 && tokensDisponibles < costoOperacion

  const handleIrAPagar = async () => {
    if (!user?.id) return
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/pagos/checkout-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          conjunto_id: selectedConjuntoId || undefined,
          cantidad_tokens: cantidadCompra,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Error al generar enlace de pago')
        return
      }
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
        setModalCompraOpen(false)
      }
    } catch {
      toast.error('Error al generar enlace de pago')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0B0E14' }}>
      {/* Header */}
      <header className="border-b rounded-b-3xl shadow-soft" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0B0E14' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold text-white">
              Asambleas App
            </h1>
            <div className="flex items-center flex-wrap gap-3">
              <ConjuntoSelector />
              {/* Billetera: tarjeta de crédito compacta 210px, glassmorphism (Saldo = profiles.tokens_disponibles, Costo = unidades conjunto) */}
              {selectedConjuntoId && (
                <div className="w-[210px] rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg overflow-hidden shrink-0">
                  <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center gap-2">
                    <Wallet className="w-4 h-4 shrink-0" style={{ color: colorPrincipalHex }} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Billetera</span>
                  </div>
                  <div className="px-3.5 py-3 space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Saldo</p>
                      <p className="text-lg font-bold leading-tight" style={{ color: colorPrincipalHex }}>
                        {tokensDisponibles} <span className="text-sm font-medium text-slate-300">tokens</span>
                      </p>
                    </div>
                    {costoOperacion > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Costo por operación</p>
                        <p className="text-sm font-semibold text-slate-200">{costoOperacion} tokens</p>
                      </div>
                    )}
                    {precioProCop != null && precioProCop > 0 && (
                      <p className="text-[10px] text-slate-500">Paga solo {formatPrecioCop(precioProCop)}/unidad · Ahorra hasta 75%</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalCompraOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-3xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: colorPrincipalHex }}
                      title="Abrir modal de compra (rápida o libre)"
                    >
                      <Plus className="w-4 h-4" />
                      Recargar
                    </button>
                  </div>
                </div>
              )}
              {/* Modal compra: rápida (cantidad = unidades) o libre; total = cantidad × precio global */}
              <Dialog open={modalCompraOpen} onOpenChange={setModalCompraOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-slate-100">Comprar tokens</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tipoCompra"
                          checked={compraRapida}
                          onChange={() => setCompraRapida(true)}
                          className="rounded border-slate-500"
                        />
                        <span className="text-sm text-slate-200">Compra rápida</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tipoCompra"
                          checked={!compraRapida}
                          onChange={() => setCompraRapida(false)}
                          className="rounded border-slate-500"
                        />
                        <span className="text-sm text-slate-200">Compra libre</span>
                      </label>
                    </div>
                    {compraRapida ? (
                      <p className="text-sm text-slate-400">
                        Cantidad: <strong className="text-slate-200">{Math.max(MIN_TOKENS_COMPRA, costoOperacion)}</strong> tokens (mín. {MIN_TOKENS_COMPRA}, según unidades de tu conjunto)
                      </p>
                    ) : (
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Cantidad de tokens (mín. {MIN_TOKENS_COMPRA})</label>
                        <input
                          type="number"
                          min={MIN_TOKENS_COMPRA}
                          value={cantidadManual}
                          onChange={(e) => setCantidadManual(Math.max(MIN_TOKENS_COMPRA, parseInt(e.target.value, 10) || MIN_TOKENS_COMPRA))}
                          className="w-full rounded-2xl border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                        />
                      </div>
                    )}
                    {precioProCop != null && precioProCop > 0 && (
                      <p className="text-sm font-semibold text-slate-200">
                        Total a pagar: {formatPrecioCop(totalPagarCop)} <span className="text-slate-400 font-normal">({cantidadCompra} × {formatPrecioCop(precioProCop)})</span>
                      </p>
                    )}
                    {puedePagar ? (
                      <button
                        type="button"
                        onClick={handleIrAPagar}
                        disabled={checkoutLoading}
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-3xl text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-70"
                        style={{ backgroundColor: colorPrincipalHex }}
                      >
                        {checkoutLoading ? (
                          <span className="animate-pulse">Generando enlace...</span>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Ir a pagar
                          </>
                        )}
                      </button>
                    ) : (
                      <UiTooltip content="La pasarela de pagos no está configurada. Contacta al administrador para habilitar la compra de tokens.">
                        <span className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-3xl bg-slate-500/50 text-slate-300 text-sm font-semibold cursor-not-allowed">
                          <Plus className="w-4 h-4" />
                          Ir a pagar
                        </span>
                      </UiTooltip>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <div className="flex items-center space-x-3">
              {user?.email && isAdminEmail(user.email) && (
                <UiTooltip content="Panel de super administrador: conjuntos, créditos y configuración">
                  <a
                    href="/super-admin"
                    onClick={(e) => {
                      e.preventDefault()
                      window.location.href = '/super-admin'
                    }}
                    className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-3xl transition-colors inline-flex items-center space-x-2 cursor-pointer"
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
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-3xl transition-colors inline-flex items-center space-x-2"
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
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-3xl transition-colors"
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" style={{ backgroundColor: '#0B0E14' }}>
        <div className="space-y-8">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-3xl p-4 animate-fade-in">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-green-200 font-medium">
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
              whatsappNumber={whatsappNumber}
              variant={tokensDisponibles === 0 ? 'blocked' : 'low'}
              planType={null}
            />
          )}

          {/* Welcome Card */}
          <div className="rounded-3xl shadow-xl p-8 border" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.6)' }}>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${colorPrincipalHex}99` }}>
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
                <h2 className="text-3xl font-bold text-white mb-2">
                  ¡Bienvenido!
                </h2>
                <p className="text-slate-300 text-lg">
                  {user?.email}
                </p>
                <p className="text-slate-400 mt-1">
                  Estás listo para gestionar tus asambleas
                </p>
                {selectedConjuntoId && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-400">
                      Saldo: <strong className="text-slate-200">{tokensDisponibles} tokens</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalCompraOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-white/20 text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
                      title="Abrir modal de compra de tokens"
                    >
                      <Plus className="w-4 h-4" />
                      Cargar Créditos
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Card */}
          <div className="rounded-3xl shadow-lg p-8 border" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.6)' }}>
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
                <h3 className="text-2xl font-bold text-white mb-2">
                  Comienza ahora
                </h3>
                <p className="text-slate-400">
                  Crea tu primer conjunto residencial y empieza a gestionar tus asambleas
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <UiTooltip content="Crear un nuevo conjunto residencial para gestionar sus asambleas y unidades">
                  <Link
                    href="/dashboard/nuevo-conjunto"
                    className="inline-flex items-center justify-center px-8 py-4 text-white font-semibold rounded-3xl shadow-lg hover:opacity-90 transition-all duration-200 space-x-2"
                    style={{ backgroundColor: colorPrincipalHex }}
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
                    className="inline-flex items-center justify-center px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-3xl shadow-lg hover:shadow-xl transition-all duration-200 space-x-2"
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
                <UiTooltip content={tokensInsuficientes ? 'Recarga tokens para gestionar este conjunto' : 'Ver y crear asambleas, preguntas y votaciones del conjunto'}>
                  {tokensInsuficientes ? (
                    <span className="inline-flex items-center justify-center px-8 py-4 rounded-3xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 font-semibold space-x-2 cursor-not-allowed opacity-90">
                      <Lock className="w-5 h-5" />
                      <span>Asambleas</span>
                      <span className="text-xs font-normal block sm:inline">(Recarga tokens)</span>
                    </span>
                  ) : (
                    <Link
                      href="/dashboard/asambleas"
                      className="inline-flex items-center justify-center px-8 py-4 text-white font-semibold rounded-3xl shadow-lg hover:opacity-90 transition-all duration-200 space-x-2"
                      style={{ backgroundColor: colorPrincipalHex }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Asambleas</span>
                    </Link>
                  )}
                </UiTooltip>
              </div>
            </div>
          </div>

          {/* Métricas Detalladas — 3 tarjetas (Total Unidades, Suma Coeficientes, Conjuntos) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0 w-full">
            {/* Total Unidades */}
            <div className="min-w-0 flex overflow-hidden w-full">
              <UiTooltip content="Ver listado de unidades, editar y gestionar coeficientes">
                <Link href="/dashboard/unidades" className="block w-full min-w-0 flex-1 overflow-hidden">
                  <div className="h-full min-h-[180px] flex flex-col rounded-3xl shadow-lg p-5 border hover:shadow-xl hover:border-green-400/50 transition-all cursor-pointer min-w-0 overflow-hidden w-full" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.6)' }}>
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-white shrink-0">{metrics.total}</p>
                    <p className="text-sm text-slate-400 mt-1 mt-auto min-w-0 truncate" title="Total Unidades • Clic para gestionar">
                      Total Unidades • Clic para gestionar
                    </p>
                  </div>
                </Link>
              </UiTooltip>
            </div>

            {/* Suma Coeficientes */}
            <div className="min-w-0 flex overflow-hidden w-full">
              <div className="w-full h-full min-h-[180px] flex flex-col rounded-3xl shadow-lg p-5 border min-w-0 overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.6)' }} title="La Ley 675 exige que la suma de coeficientes sea 100%. Verde = correcto.">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${Math.abs(metrics.sumaCoeficientes - 100) < 0.000001 ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                    <svg className={`w-6 h-6 ${Math.abs(metrics.sumaCoeficientes - 100) < 0.000001 ? 'text-green-400' : 'text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {Math.abs(metrics.sumaCoeficientes - 100) < 0.000001 ? (
                    <svg className="w-5 h-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  )}
                </div>
                <p className="text-2xl font-bold text-white shrink-0">{metrics.sumaCoeficientes.toFixed(2)}%</p>
                <p className="text-sm text-slate-400 mt-1 mt-auto min-w-0 truncate" title="Suma Coeficientes (Ley 675)">Suma Coeficientes (Ley 675)</p>
              </div>
            </div>

            {/* Conjuntos Registrados */}
            <div className="min-w-0 flex overflow-hidden w-full">
              <UiTooltip content="Ver y editar los conjuntos residenciales que gestionas">
                <Link href="/dashboard/conjuntos" className="block w-full min-w-0 flex-1 overflow-hidden">
                  <div className="h-full min-h-[180px] flex flex-col rounded-3xl shadow-lg p-5 border hover:shadow-xl hover:border-purple-400/50 transition-all cursor-pointer min-w-0 overflow-hidden w-full" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.6)' }}>
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-white shrink-0">{conjuntosCount}</p>
                    <p className="text-sm text-slate-400 mt-1 mt-auto min-w-0 truncate" title="Conjuntos Registrados">Conjuntos Registrados</p>
                  </div>
                </Link>
              </UiTooltip>
            </div>
          </div>

          {/* Botón para abrir Guía en modal */}
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => setGuiaModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-3xl border border-white/20 text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              <HelpCircle className="w-4 h-4 text-violet-400" style={{ color: colorPrincipalHex }} />
              Guía: tokens y funcionalidades
            </button>
          </div>
        </div>
      </main>

      {/* Modal: Guía tokens y funcionalidades */}
      <Dialog open={guiaModalOpen} onOpenChange={setGuiaModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-0" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0B0E14' }}>
          <DialogHeader className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-200">
              <HelpCircle className="w-6 h-6 text-violet-400" style={{ color: colorPrincipalHex }} />
              Guía: tokens y funcionalidades
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm" style={{ backgroundColor: `${colorPrincipalHex}30`, color: colorPrincipalHex }}>1</span>
                ¿Qué son los tokens y cuándo se consumen?
              </h4>
              <p className="text-sm text-slate-400">
                Los tokens son créditos de tu billetera. El costo de una operación equivale al número de unidades de tu conjunto (1 token = 1 unidad). Se descuentan <strong className="text-slate-300">en el momento</strong> en que realizas una de estas acciones:
              </p>
              <ul className="list-none space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0" style={{ color: colorPrincipalHex }}>•</span>
                  <span><strong className="text-slate-300">Activar votación</strong> — Al abrir la votación para que los copropietarios voten en una asamblea.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0" style={{ color: colorPrincipalHex }}>•</span>
                  <span><strong className="text-slate-300">Descargar acta con auditoría</strong> — Al generar el PDF del acta con detalle de votos y coeficientes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0" style={{ color: colorPrincipalHex }}>•</span>
                  <span><strong className="text-slate-300">Registro manual de voto</strong> — Cuando registras un voto en nombre de un copropietario desde el panel de control.</span>
                </li>
              </ul>
              <p className="text-xs text-slate-500">
                Crear asambleas, preguntas o importar unidades <strong>no</strong> consume tokens. Si tu saldo es menor al costo por operación, no podrás activar votaciones ni descargar actas hasta que compres más tokens. La compra de tokens es desde 20 unidades en adelante y se realiza únicamente por la pasarela de pagos (no por WhatsApp).
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">2</span>
                ¿Qué puedes hacer con la aplicación?
              </h4>
              <ul className="list-none space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span><strong className="text-slate-300">Conjuntos y unidades</strong> — Registrar conjuntos residenciales, cargar unidades con coeficientes (Ley 675) y datos de contacto.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span><strong className="text-slate-300">Asambleas</strong> — Crear asambleas, definir preguntas y opciones de votación (Sí/No u otras).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span><strong className="text-slate-300">Votaciones en línea</strong> — Enviar enlace a copropietarios para que voten desde el celular o PC; ver en tiempo real quién ha votado y resultados por coeficiente.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span><strong className="text-slate-300">Actas</strong> — Generar actas con resultados, umbral de aprobación y auditoría (consumen tokens).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span><strong className="text-slate-300">Billetera de tokens</strong> — Comprar tokens desde 20 en adelante por pasarela de pagos; los nuevos gestores reciben un bono de bienvenida.</span>
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
