'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Building2, ArrowLeft, Save, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function EditarConjuntoPage() {
  const params = useParams()
  const router = useRouter()
  const conjuntoId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [direccion, setDireccion] = useState('')
  const [ciudad, setCiudad] = useState('')

  useEffect(() => {
    loadConjunto()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when conjuntoId changes
  }, [conjuntoId])

  const loadConjunto = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Verificar que el usuario tiene acceso a este conjunto
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', conjuntoId)
        .maybeSingle()

      if (!profile) {
        setError('No tienes permiso para editar este conjunto')
        return
      }

      // Cargar datos del conjunto
      const { data: conjunto, error: conjuntoError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', conjuntoId)
        .single()

      if (conjuntoError) {
        throw conjuntoError
      }

      setNombre(conjunto.name || '')
      setNit(conjunto.nit || '')
      setDireccion(conjunto.address || '')
      setCiudad(conjunto.city || '')
    } catch (error: any) {
      console.error('Error loading conjunto:', error)
      setError('Error al cargar el conjunto')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      if (!nombre.trim()) {
        throw new Error('El nombre del conjunto es obligatorio')
      }

      // Validar NIT único si se proporciona
      if (nit && nit.trim()) {
        const { data: existingOrg } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('nit', nit)
          .neq('id', conjuntoId)
          .maybeSingle()

        if (existingOrg) {
          throw new Error(`El NIT ${nit} ya está registrado para el conjunto "${existingOrg.name}"`)
        }
      }

      // Actualizar el conjunto
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: nombre,
          nit: nit || null,
          address: direccion,
          city: ciudad,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conjuntoId)

      if (updateError) {
        console.error('Error updating organization:', updateError)
        
        if (updateError.code === '23505' && updateError.message.includes('unique_organization_nit')) {
          throw new Error(`El NIT ${nit} ya está registrado`)
        }
        
        throw new Error('Error al actualizar el conjunto: ' + updateError.message)
      }

      setSuccess(true)
      
      // Redirigir después de 1.5 segundos
      setTimeout(() => {
        router.push('/dashboard/conjuntos')
      }, 1500)
    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al actualizar el conjunto')
    } finally {
      setSaving(false)
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard/conjuntos"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Editar Conjunto
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Actualiza la información de tu conjunto residencial
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          {/* Header Card */}
          <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Datos del Conjunto
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Completa o actualiza la información legal de tu conjunto residencial
              </p>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-800 dark:text-green-300">
                ¡Actualizado correctamente!
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-400">
                Los datos del conjunto se han actualizado exitosamente. Redirigiendo...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre del Conjunto */}
            <div>
              <label
                htmlFor="nombre"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Nombre del Conjunto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Ej: Conjunto Residencial Los Alpes"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Nombre legal completo de la copropiedad
              </p>
            </div>

            {/* NIT */}
            <div>
              <label
                htmlFor="nit"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                NIT <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nit"
                required
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="900123456-7"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Formato: 900123456-7 (único por conjunto)
              </p>
            </div>

            {/* Dirección */}
            <div>
              <label
                htmlFor="direccion"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="direccion"
                required
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Ej: Carrera 50 #150A-50"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Dirección principal del conjunto
              </p>
            </div>

            {/* Ciudad */}
            <div>
              <label
                htmlFor="ciudad"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Ciudad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="ciudad"
                required
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Ej: Bogotá"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Ciudad donde se ubica el conjunto
              </p>
            </div>

            {/* Buttons */}
            <div className="flex space-x-4 pt-6">
              <Link href="/dashboard/conjuntos" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
