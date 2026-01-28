'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Building2, ArrowLeft, MapPin, FileText, Home, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Conjunto {
  id: string
  name: string
  slug: string
  nit?: string
  address?: string
  city?: string
  created_at: string
  unidades_count: number
}

export default function ConjuntosPage() {
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadConjuntos()
  }, [])

  const loadConjuntos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Obtener todos los conjuntos del usuario
      const { data: profiles } = await supabase
        .from('profiles')
        .select('organization_id, organizations(id, name, slug, nit, address, city, created_at)')
        .eq('user_id', user.id)
        .not('organization_id', 'is', null)
        .order('created_at', { ascending: false })

      if (profiles && profiles.length > 0) {
        const conjuntosData = await Promise.all(
          profiles
            .filter(p => p.organizations && Array.isArray(p.organizations) ? p.organizations.length > 0 : !!p.organizations)
            .map(async (p) => {
              // Supabase puede devolver organizations como array o como objeto
              const org = Array.isArray(p.organizations) ? p.organizations[0] : p.organizations
              
              if (!org) return null

              // Contar unidades de cada conjunto
              const { count } = await supabase
                .from('unidades')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)

              return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                nit: org.nit,
                address: org.address,
                city: org.city,
                created_at: org.created_at,
                unidades_count: count || 0,
              }
            })
        )

        // Filtrar nulls
        setConjuntos(conjuntosData.filter(c => c !== null))
      }
    } catch (error) {
      console.error('Error loading conjuntos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectConjunto = (conjuntoId: string) => {
    localStorage.setItem('selectedConjuntoId', conjuntoId)
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando conjuntos...</p>
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
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Mis Conjuntos
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Administra todos tus conjuntos residenciales
                </p>
              </div>
            </div>
            <Link href="/dashboard/nuevo-conjunto">
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                <Building2 className="w-4 h-4 mr-2" />
                Nuevo Conjunto
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {conjuntos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No tienes conjuntos registrados
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Crea tu primer conjunto para comenzar a gestionar asambleas
            </p>
            <Link href="/dashboard/nuevo-conjunto">
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                <Building2 className="w-4 h-4 mr-2" />
                Registrar Primer Conjunto
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {conjuntos.map((conjunto) => (
              <div
                key={conjunto.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Header Card */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{conjunto.name}</h2>
                        {conjunto.city && (
                          <p className="text-sm text-indigo-100 flex items-center mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {conjunto.city}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body Card */}
                <div className="p-6 space-y-4">
                  {/* Detalles */}
                  <div className="space-y-3">
                    {conjunto.nit && (
                      <div className="flex items-start space-x-3">
                        <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">NIT</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {conjunto.nit}
                          </p>
                        </div>
                      </div>
                    )}

                    {conjunto.address && (
                      <div className="flex items-start space-x-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Dirección</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {conjunto.address}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-3">
                      <Home className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Unidades</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {conjunto.unidades_count} registradas
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Registrado el {new Date(conjunto.created_at).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSelectConjunto(conjunto.id)}
                    >
                      Administrar
                    </Button>
                    <Link href={`/dashboard/conjuntos/${conjunto.id}/editar`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
