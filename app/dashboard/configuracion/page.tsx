'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { CreditCard, ChevronDown, ChevronUp, RefreshCw, User as UserIcon, Lock, Building2, Receipt } from 'lucide-react'

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

  // Estados del formulario de organización
  const [orgName, setOrgName] = useState('')
  const [orgNit, setOrgNit] = useState('')
  const [orgAddress, setOrgAddress] = useState('')

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

  const secciones = [
    { id: 'perfil', label: 'Mi perfil', icon: UserIcon },
    { id: 'contraseña', label: 'Contraseña', icon: Lock },
    { id: 'conjunto', label: 'Datos del conjunto', icon: Building2 },
    { id: 'pagos', label: 'Mis pagos', icon: Receipt },
  ]

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)

      // Cargar perfil
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

        // Cargar organización si existe
        if (profileData.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single()

          if (orgError && orgError.code !== 'PGRST116') {
            throw orgError
          }

          if (orgData) {
            setOrganization(orgData)
            setOrgName(orgData.name || '')
            setOrgNit(orgData.nit || '')
            setOrgAddress(orgData.address || '')
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

  useEffect(() => {
    if (user) loadPagos()
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
    setSaving(true)
    setMessage('')
    setError('')

    try {
      if (organization) {
        // Actualizar organización existente
        const { error } = await supabase
          .from('organizations')
          .update({
            name: orgName,
            nit: orgNit,
            address: orgAddress,
            updated_at: new Date().toISOString(),
          })
          .eq('id', organization.id)

        if (error) throw error
      } else {
        // Crear nueva organización
        const slug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: orgName,
            nit: orgNit,
            address: orgAddress,
            slug: `${slug}-${Date.now()}`,
          })
          .select()
          .single()

        if (orgError) throw orgError

        // Actualizar perfil con la organización
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            organization_id: newOrg.id,
            role: 'owner',
          })
          .eq('id', user!.id)

        if (profileError) throw profileError

        setOrganization(newOrg)
      }

      setMessage('Datos del conjunto actualizados correctamente')
      setTimeout(() => setMessage(''), 3000)
      await loadData() // Recargar datos
    } catch (error: any) {
      console.error('Error saving organization:', error)
      setError('Error al guardar los datos del conjunto')
    } finally {
      setSaving(false)
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
                  Información legal de la copropiedad
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveOrganization} className="space-y-4">
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
                  placeholder="Calle 123 # 45-67, Bogotá"
                  rows={3}
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !orgName}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-3xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : organization ? 'Actualizar Datos del Conjunto' : 'Registrar Conjunto'}
              </button>
            </form>
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

          </div>
        </div>
      </main>
    </div>
  )
}
