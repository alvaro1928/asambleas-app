'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { CreditCard, ChevronDown, ChevronUp, RefreshCw, User as UserIcon, Lock, Building2, Receipt, Users, Mail, Coins } from 'lucide-react'

interface Profile {
  id: string
  email: string
  full_name: string | null
  organization_id: string | null
}

interface Organization {
  id: string
  name: string
  nit: string | null
  address: string | null
  city: string | null
}

export default function ConfiguracionPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  // Estados del formulario de perfil
  const [fullName, setFullName] = useState('')

  // Estados del formulario de organización (conjunto seleccionado para editar)
  const [conjuntosList, setConjuntosList] = useState<Organization[]>([])
  const [selectedConjuntoId, setSelectedConjuntoId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgNit, setOrgNit] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [orgCity, setOrgCity] = useState('')

  // Estados para cambiar contraseña
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Pagos del usuario
  interface PagoItem {
    id: string
    organization_id: string
    organization_name: string
    monto_centavos: number
    wompi_transaction_id: string | null
    estado: string
    created_at: string
  }
  const [pagos, setPagos] = useState<PagoItem[]>([])
  const [pagosLoading, setPagosLoading] = useState(false)
  const [pagoDetalleId, setPagoDetalleId] = useState<string | null>(null)

  // Configuración poderes y correo (por conjunto)
  const [maxPoderesPorApoderado, setMaxPoderesPorApoderado] = useState<number>(3)
  const [plantillaAdicionalCorreo, setPlantillaAdicionalCorreo] = useState('')
  const [savingConfigPoderes, setSavingConfigPoderes] = useState(false)

  // Uso de tokens (billing_logs)
  interface UsoTokenItem {
    id: string
    fecha: string
    tipo_operacion: string
    tokens_usados: number
    saldo_restante: number
    asamblea_nombre: string | null
    conjunto_nombre: string | null
    metadata: Record<string, unknown> | null
  }
  const [usoTokens, setUsoTokens] = useState<UsoTokenItem[]>([])
  const [usoTokensLoading, setUsoTokensLoading] = useState(false)

  const secciones = [
    { id: 'perfil', label: 'Mi perfil', icon: UserIcon, orden: 1 },
    { id: 'contraseña', label: 'Contraseña', icon: Lock, orden: 2 },
    { id: 'conjunto', label: 'Datos del conjunto', icon: Building2, orden: 3 },
    { id: 'poderes-correo', label: 'Poderes y correo', icon: Users, orden: 4 },
    { id: 'pagos', label: 'Mis pagos', icon: Receipt, orden: 5 },
    { id: 'uso-tokens', label: 'Uso de tokens (créditos)', icon: Coins, orden: 6 },
  ].sort((a, b) => (a.orden as number) - (b.orden as number))

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  // Al cambiar el conjunto a editar, cargar sus datos en el formulario
  useEffect(() => {
    if (!selectedConjuntoId || conjuntosList.length === 0) return
    const org = conjuntosList.find((o) => o.id === selectedConjuntoId)
    if (org) {
      setOrganization(org)
      setOrgName(org.name || '')
      setOrgNit(org.nit || '')
      setOrgAddress(org.address || '')
      setOrgCity(org.city || '')
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedConjuntoId', selectedConjuntoId)
    }
    // Cargar configuración de poderes y correo
    if (selectedConjuntoId) {
      supabase
        .from('configuracion_poderes')
        .select('max_poderes_por_apoderado, plantilla_adicional_correo')
        .eq('organization_id', selectedConjuntoId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setMaxPoderesPorApoderado(Number(data.max_poderes_por_apoderado) || 3)
            setPlantillaAdicionalCorreo(data.plantilla_adicional_correo ?? '')
          } else {
            setMaxPoderesPorApoderado(3)
            setPlantillaAdicionalCorreo('')
          }
        })
    }
  }, [selectedConjuntoId, conjuntosList])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)

      // Cargar perfil (para nombre y email)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
      }

      if (profileData) {
        setProfile(profileData)
        setFullName(profileData.full_name || '')
      }

      // Conjuntos a los que el usuario tiene acceso (profiles con user_id = user.id)
      const { data: profilesList } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .not('organization_id', 'is', null)

      const orgIds = Array.from(new Set((profilesList || []).map((p: { organization_id: string }) => p.organization_id)))
      if (orgIds.length > 0) {
        const { data: orgsData } = await supabase
          .from('organizations')
          .select('id, name, nit, address, city')
          .in('id', orgIds)
        const list = (orgsData || []) as Organization[]
        setConjuntosList(list)

        const savedId = typeof window !== 'undefined' ? localStorage.getItem('selectedConjuntoId') : null
        const idToUse = savedId && list.some((o) => o.id === savedId) ? savedId : list[0]?.id || null
        setSelectedConjuntoId(idToUse)

        if (idToUse) {
          const org = list.find((o) => o.id === idToUse)
          if (org) {
            setOrganization(org)
            setOrgName(org.name || '')
            setOrgNit(org.nit || '')
            setOrgAddress(org.address || '')
            setOrgCity(org.city || '')
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
      setError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const loadPagos = async () => {
    setPagosLoading(true)
    try {
      const res = await fetch('/api/dashboard/mis-pagos', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.pagos)) {
        setPagos(data.pagos)
      } else {
        setPagos([])
      }
    } catch {
      setPagos([])
    } finally {
      setPagosLoading(false)
    }
  }

  const loadUsoTokens = async () => {
    setUsoTokensLoading(true)
    try {
      const res = await fetch('/api/dashboard/uso-tokens', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.uso)) {
        setUsoTokens(data.uso)
      } else {
        setUsoTokens([])
      }
    } catch {
      setUsoTokens([])
    } finally {
      setUsoTokensLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadPagos()
  }, [user])

  useEffect(() => {
    if (user) loadUsoTokens()
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user!.id,
          email: user!.email,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      setMessage('Perfil actualizado correctamente')
      setTimeout(() => setMessage(''), 3000)
    } catch (error: any) {
      console.error('Error saving profile:', error)
      setError('Error al guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization?.id) {
      setError('Selecciona un conjunto para editar')
      return
    }
    setSaving(true)
    setMessage('')
    setError('')

    try {
      // Validar NIT único si se proporciona
      if (orgNit && orgNit.trim()) {
        const { data: existingOrg } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('nit', orgNit.trim())
          .neq('id', organization.id)
          .maybeSingle()
        if (existingOrg) {
          throw new Error(`El NIT ${orgNit} ya está registrado para el conjunto "${existingOrg.name}"`)
        }
      }

      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName.trim(),
          nit: orgNit?.trim() || null,
          address: orgAddress?.trim() || null,
          city: orgCity?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization.id)

      if (error) throw error

      setMessage('Datos del conjunto actualizados correctamente')
      setTimeout(() => setMessage(''), 3000)
      setConjuntosList((prev) =>
        prev.map((o) =>
          o.id === organization.id
            ? { ...o, name: orgName.trim(), nit: orgNit?.trim() || null, address: orgAddress?.trim() || null, city: orgCity?.trim() || null }
            : o
        )
      )
      setOrganization((prev) =>
        prev ? { ...prev, name: orgName.trim(), nit: orgNit?.trim() || null, address: orgAddress?.trim() || null, city: orgCity?.trim() || null } : null
      )
    } catch (error: any) {
      console.error('Error saving organization:', error)
      setError(error?.message || 'Error al guardar los datos del conjunto')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveConfigPoderes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConjuntoId) {
      setError('Selecciona un conjunto')
      return
    }
    setSavingConfigPoderes(true)
    setMessage('')
    setError('')
    try {
      const { error: upsertError } = await supabase
        .from('configuracion_poderes')
        .upsert(
          {
            organization_id: selectedConjuntoId,
            max_poderes_por_apoderado: Math.max(1, Math.min(10, maxPoderesPorApoderado)),
            plantilla_adicional_correo: plantillaAdicionalCorreo.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id' }
        )
      if (upsertError) throw upsertError
      setMessage('Configuración de poderes y correo guardada')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err?.message || 'Error al guardar')
    } finally {
      setSavingConfigPoderes(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage('')
    setPasswordError('')
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden')
      return
    }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordMessage('Contraseña actualizada. Ya puedes entrar con email y contraseña.')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(''), 5000)
    } catch (err: any) {
      setPasswordError(err?.message || 'Error al actualizar la contraseña')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Configuración
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: menú + contenido */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Menú de secciones */}
          <nav className="lg:w-56 shrink-0">
            <div className="lg:sticky lg:top-6 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-3 mb-3 hidden lg:block">
                Secciones
              </p>
              {/* Desktop: lista vertical */}
              <div className="hidden lg:flex flex-col gap-0.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-1">
                {secciones.map((s) => {
                  const Icon = s.icon
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors text-sm font-medium"
                    >
                      <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      {s.label}
                    </a>
                  )
                })}
              </div>
              {/* Móvil: scroll horizontal */}
              <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 -mx-1 scrollbar-thin">
                {secciones.map((s) => {
                  const Icon = s.icon
                  return (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium whitespace-nowrap shrink-0 hover:bg-gray-50 dark:hover:bg-gray-700/80"
                    >
                      <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      {s.label}
                    </a>
                  )
                })}
              </div>
            </div>
          </nav>

          <div className="flex-1 min-w-0 space-y-8">
          {/* Messages */}
          {message && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-3xl p-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-green-800 dark:text-green-300">{message}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Perfil de Usuario */}
          <div id="perfil" className="scroll-mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
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
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Datos de Perfil
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Información personal de tu cuenta
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  El correo no se puede cambiar
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alvaro Contreras"
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-3xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Guardar Perfil'}
              </button>
            </form>
          </div>

          {/* Cambiar contraseña */}
          <div id="contraseña" className="scroll-mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Contraseña
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Establece o cambia tu contraseña para entrar con email y contraseña
                </p>
              </div>
            </div>

            {passwordMessage && (
              <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-3xl p-4">
                <p className="text-sm text-green-800 dark:text-green-300">{passwordMessage}</p>
              </div>
            )}
            {passwordError && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-4">
                <p className="text-sm text-red-800 dark:text-red-300">{passwordError}</p>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  minLength={6}
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-3xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordSaving ? 'Guardando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </div>

          {/* Datos del Conjunto */}
          <div id="conjunto" className="scroll-mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-3xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600 dark:text-purple-400"
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Datos Legales del Conjunto
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Edita la información del conjunto seleccionado
                </p>
              </div>
            </div>

            {conjuntosList.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-800 dark:text-amber-200">
                <p className="font-medium">No tienes conjuntos registrados</p>
                <p className="text-sm mt-1">Crea un conjunto desde el dashboard para poder editar sus datos aquí.</p>
                <Link href="/dashboard/nuevo-conjunto" className="inline-block mt-3 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline">
                  Crear conjunto →
                </Link>
              </div>
            ) : (
            <form onSubmit={handleSaveOrganization} className="space-y-4">
              {conjuntosList.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Conjunto a editar
                  </label>
                  <select
                    value={selectedConjuntoId || ''}
                    onChange={(e) => setSelectedConjuntoId(e.target.value || null)}
                    className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {conjuntosList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre del Conjunto *
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="Conjunto Residencial Los Cedros"
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  NIT
                </label>
                <input
                  type="text"
                  value={orgNit}
                  onChange={(e) => setOrgNit(e.target.value)}
                  placeholder="900.123.456-7"
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dirección
                </label>
                <textarea
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  placeholder="Calle 123 # 45-67"
                  rows={2}
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={orgCity}
                  onChange={(e) => setOrgCity(e.target.value)}
                  placeholder="Bogotá"
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !orgName.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-3xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Actualizar datos del conjunto'}
              </button>
            </form>
            )}
          </div>

          {/* Poderes y correo */}
          <div id="poderes-correo" className="scroll-mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Poderes y plantilla de correo
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Límite de poderes por apoderado y texto adicional para los correos de votación
                </p>
              </div>
            </div>

            {conjuntosList.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-800 dark:text-amber-200">
                <p className="font-medium">Selecciona un conjunto primero</p>
                <p className="text-sm mt-1">Configura datos del conjunto antes de ajustar poderes y correo.</p>
              </div>
            ) : (
            <form onSubmit={handleSaveConfigPoderes} className="space-y-4">
              {conjuntosList.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Conjunto
                  </label>
                  <select
                    value={selectedConjuntoId || ''}
                    onChange={(e) => setSelectedConjuntoId(e.target.value || null)}
                    className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {conjuntosList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Máximo poderes por apoderado
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxPoderesPorApoderado}
                  onChange={(e) => setMaxPoderesPorApoderado(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3)))}
                  className="w-full max-w-xs px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Según Ley 675, típico 2–3. Limita cuántos poderes puede recibir una misma persona.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Texto adicional para correos de votación <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={plantillaAdicionalCorreo}
                  onChange={(e) => setPlantillaAdicionalCorreo(e.target.value)}
                  placeholder="Ej: Únete a la sesión por Teams: https://teams.microsoft.com/...&#10;&#10;O: Enlace a Google Meet: https://meet.google.com/..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Se añadirá al correo que envía el sistema al mandar el enlace de votación. Ideal para incluir enlace a sesión Teams, Google Meet, etc.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingConfigPoderes}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-3xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingConfigPoderes ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </form>
            )}
          </div>

          {/* Mis pagos */}
          <div id="pagos" className="scroll-mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Mis pagos
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Historial de compras de tokens asociadas a tus conjuntos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadPagos}
                disabled={pagosLoading}
                className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                title="Actualizar lista"
              >
                <RefreshCw className={`w-5 h-5 ${pagosLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {pagosLoading && pagos.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                Cargando pagos...
              </div>
            ) : pagos.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                No hay pagos registrados. Las compras de tokens aparecerán aquí una vez procesadas.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Fecha</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Conjunto</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Monto</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                      <th className="w-10 py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((pago) => {
                      const fecha = new Date(pago.created_at).toLocaleString('es-CO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                      const montoCop = (pago.monto_centavos / 100).toLocaleString('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })
                      const isOpen = pagoDetalleId === pago.id
                      return (
                        <React.Fragment key={pago.id}>
                          <tr
                            className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-900/30"
                          >
                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{fecha}</td>
                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{pago.organization_name}</td>
                            <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">{montoCop}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  pago.estado === 'APPROVED'
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                                    : pago.estado === 'PENDING'
                                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {pago.estado === 'APPROVED' ? 'Aprobado' : pago.estado === 'PENDING' ? 'Pendiente' : pago.estado}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              <button
                                type="button"
                                onClick={() => setPagoDetalleId(isOpen ? null : pago.id)}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                                title={isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                              >
                                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`detalle-${pago.id}`}>
                              <td colSpan={5} className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">ID transacción (Wompi):</span>
                                    <p className="font-mono text-gray-900 dark:text-white break-all">{pago.wompi_transaction_id || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Monto:</span>
                                    <p className="font-semibold text-gray-900 dark:text-white">{montoCop}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Conjunto:</span>
                                    <p className="text-gray-900 dark:text-white">{pago.organization_name}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                                    <p className="text-gray-900 dark:text-white">{pago.estado}</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Uso de tokens */}
          <div id="uso-tokens" className="scroll-mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Uso de tokens
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Historial de operaciones que han consumido tus tokens (votación, acta, WhatsApp, etc.)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadUsoTokens}
                disabled={usoTokensLoading}
                className="p-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                title="Actualizar lista"
              >
                <RefreshCw className={`w-5 h-5 ${usoTokensLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {usoTokensLoading && usoTokens.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                Cargando uso de tokens...
              </div>
            ) : usoTokens.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                Aún no hay registros de uso de tokens. Aquí aparecerán las operaciones que consuman tu saldo (activar votación, descargar acta, notificar por WhatsApp, etc.).
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Fecha y hora</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Operación</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Tokens (créditos)</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Saldo restante</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usoTokens.map((row) => {
                      const fechaHora = new Date(row.fecha).toLocaleString('es-CO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                      const operacionLabel =
                        row.tipo_operacion === 'Votación'
                          ? 'Activar votación'
                          : row.tipo_operacion === 'Acta'
                            ? 'Descargar acta'
                            : row.tipo_operacion === 'Registro_manual'
                              ? 'Registro manual'
                              : row.tipo_operacion === 'Compra'
                                ? 'Compra'
                                : row.tipo_operacion === 'Ajuste_manual'
                                  ? 'Ajuste manual'
                                  : row.tipo_operacion === 'WhatsApp'
                                    ? 'WhatsApp'
                                    : row.tipo_operacion
                      const detalle = [row.asamblea_nombre, row.conjunto_nombre].filter(Boolean).join(' · ') || '—'
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-900/30"
                        >
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fechaHora}</td>
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{operacionLabel}</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">{row.tokens_usados}</td>
                          <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">{row.saldo_restante}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={detalle}>{detalle}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          </div>
        </div>
      </main>
    </div>
  )
}
