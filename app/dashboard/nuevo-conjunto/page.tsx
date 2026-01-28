'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NuevoConjuntoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Estados del formulario
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [direccion, setDireccion] = useState('')
  const [ciudad, setCiudad] = useState('')

  const formatNIT = (value: string) => {
    // Eliminar todo excepto números y guión
    const cleaned = value.replace(/[^\d-]/g, '')
    
    // Si ya tiene formato, devolverlo
    if (cleaned.includes('-')) {
      return cleaned
    }
    
    // Si tiene solo números, formatear automáticamente
    const numbers = cleaned.replace(/-/g, '')
    if (numbers.length > 9) {
      return numbers.slice(0, 9) + '-' + numbers.slice(9, 10)
    }
    return numbers
  }

  const handleNitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNIT(e.target.value)
    setNit(formatted)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Obtener el usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        throw new Error('No hay usuario autenticado')
      }

      // Verificar si el NIT ya existe
      if (nit && nit.trim()) {
        const { data: existingOrg, error: checkError } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('nit', nit)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          throw new Error('Error al verificar el NIT')
        }

        if (existingOrg) {
          throw new Error(`El NIT ${nit} ya está registrado para el conjunto "${existingOrg.name}"`)
        }
      }

      // Crear slug único
      const baseSlug = nombre.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales
        .replace(/\s+/g, '-') // Espacios a guiones
        .replace(/-+/g, '-') // Múltiples guiones a uno
      
      const slug = `${baseSlug}-${Date.now()}`

      // Crear la organización
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: nombre,
          slug: slug,
          nit: nit || null,
          address: direccion,
          city: ciudad,
        })
        .select()
        .single()

      if (orgError) {
        console.error('Error creating organization:', orgError)
        
        // Manejar error de NIT duplicado
        if (orgError.code === '23505' && orgError.message.includes('unique_organization_nit')) {
          throw new Error(`El NIT ${nit} ya está registrado`)
        }
        
        throw new Error('Error al crear el conjunto: ' + orgError.message)
      }

      // Crear perfil para este conjunto (un usuario puede tener múltiples perfiles, uno por conjunto)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          email: user.email,
          organization_id: newOrg.id,
          role: 'owner',
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        
        // Si ya existe un perfil para este usuario en este conjunto, actualizar
        if (profileError.code === '23505') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              organization_id: newOrg.id,
              role: 'owner',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
            .eq('organization_id', newOrg.id)

          if (updateError) {
            throw new Error('Error al vincular el conjunto con tu perfil')
          }
        } else {
          throw new Error('Error al crear el perfil del conjunto')
        }
      }

      // Redirigir al dashboard con mensaje de éxito
      router.push('/dashboard?success=conjunto-creado')
      
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al registrar el conjunto')
      setLoading(false)
    }
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
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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
                Registrar Nuevo Conjunto
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Datos de la Copropiedad
                </h2>
                <p className="text-indigo-100">
                  Completa la información legal de tu conjunto residencial
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0"
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

            {/* Nombre del Conjunto */}
            <div>
              <label
                htmlFor="nombre"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Nombre del Conjunto <span className="text-red-500">*</span>
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ej: Conjunto Residencial Los Cedros"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Nombre legal completo de la copropiedad
              </p>
            </div>

            {/* NIT */}
            <div>
              <label
                htmlFor="nit"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                NIT <span className="text-red-500">*</span>
              </label>
              <input
                id="nit"
                type="text"
                value={nit}
                onChange={handleNitChange}
                required
                placeholder="Ej: 900123456-7"
                maxLength={13}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Formato: 900123456-7 (único por conjunto)
              </p>
            </div>

            {/* Dirección */}
            <div>
              <label
                htmlFor="direccion"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                id="direccion"
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                required
                placeholder="Ej: Calle 123 # 45-67"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Dirección completa del conjunto
              </p>
            </div>

            {/* Ciudad */}
            <div>
              <label
                htmlFor="ciudad"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Ciudad <span className="text-red-500">*</span>
              </label>
              <input
                id="ciudad"
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                required
                placeholder="Ej: Bogotá"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Ciudad donde se ubica el conjunto
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    Importante
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    Puedes administrar múltiples conjuntos con esta cuenta. Cada conjunto es independiente y tiene su propia base de datos de unidades y coeficientes.
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/dashboard"
                className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Registrar Conjunto</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
