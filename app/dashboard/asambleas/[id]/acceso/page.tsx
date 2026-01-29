'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Users, 
  QrCode, 
  ExternalLink, 
  RefreshCw, 
  Clock,
  CheckCircle2,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { QRCodeSVG } from 'qrcode.react'

interface Asamblea {
  id: string
  nombre: string
  codigo_acceso: string
  estado: string
}

interface Asistente {
  id: string
  email_propietario: string
  nombre_propietario: string
  hora_llegada: string
  torre: string
  numero: string
  coeficiente: number
}

export default function AsambleaAccesoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [asistentes, setAsistentes] = useState<Asistente[]>([])
  const [loading, setLoading] = useState(true)
  const [recargando, setRecargando] = useState(false)
  const [urlPublica, setUrlPublica] = useState('')

  useEffect(() => {
    loadAsamblea()
    loadAsistentes()

    // Polling cada 10 segundos
    const interval = setInterval(() => {
      loadAsistentes(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [params.id])

  const loadAsamblea = async () => {
    try {
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        router.push('/dashboard')
        return
      }

      const { data, error } = await supabase
        .from('asambleas')
        .select('id, nombre, codigo_acceso, estado')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (error) throw error
      setAsamblea(data)
      
      const origin = window.location.origin
      setUrlPublica(`${origin}/votar/${data.codigo_acceso}`)
    } catch (error) {
      console.error('Error cargando asamblea:', error)
      router.push('/dashboard/asambleas')
    }
  }

  const loadAsistentes = async (isPolling = false) => {
    if (!isPolling) setLoading(true)
    else setRecargando(true)

    try {
      // Consultar quorum con join a unidades
      const { data, error } = await supabase
        .from('quorum_asamblea')
        .select(`
          id,
          email_propietario,
          hora_llegada,
          unidades (
            torre,
            numero,
            coeficiente,
            nombre_propietario
          )
        `)
        .eq('asamblea_id', params.id)
        .eq('presente_virtual', true)
        .order('hora_llegada', { ascending: false })

      if (error) throw error

      const formattedAsistentes: Asistente[] = (data || []).map((item: any) => ({
        id: item.id,
        email_propietario: item.email_propietario,
        nombre_propietario: item.unidades?.nombre_propietario || 'S/N',
        hora_llegada: item.hora_llegada,
        torre: item.unidades?.torre || 'S/T',
        numero: item.unidades?.numero || 'S/N',
        coeficiente: item.unidades?.coeficiente || 0
      }))

      setAsistentes(formattedAsistentes)
    } catch (error) {
      console.error('Error cargando asistentes:', error)
    } finally {
      setLoading(false)
      setRecargando(false)
    }
  }

  if (loading && !asamblea) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando control de acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/dashboard/asambleas/${params.id}`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Control de Acceso y QR
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {asamblea?.nombre}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAsistentes(true)}
                disabled={recargando}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${recargando ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Panel Izquierdo: QR y Link */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-indigo-200 dark:border-indigo-900 shadow-md overflow-hidden">
              <CardHeader className="bg-indigo-600 text-white">
                <CardTitle className="text-lg flex items-center">
                  <QrCode className="w-5 h-5 mr-2" />
                  Código QR de Acceso
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 flex flex-col items-center">
                <div className="bg-white p-6 rounded-2xl shadow-inner border border-gray-100 mb-6">
                  {urlPublica && (
                    <QRCodeSVG 
                      value={urlPublica} 
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  )}
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Los asambleístas deben escanear este código para ingresar a la votación.
                </p>
                <div className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    URL de Votación
                  </p>
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <code className="text-xs text-indigo-600 dark:text-indigo-400 truncate">
                      {urlPublica}
                    </code>
                    <a 
                      href={urlPublica} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-white dark:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-600 hover:bg-gray-50"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </a>
                  </div>
                </div>
                <div className="mt-6 w-full text-center">
                   <p className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 py-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
                     CÓDIGO: {asamblea?.codigo_acceso}
                   </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-md flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-gray-500" />
                  Resumen de Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Unidades en línea</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{asistentes.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Coeficiente presente</span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {asistentes.reduce((sum, a) => sum + a.coeficiente, 0).toFixed(6)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panel Derecho: Lista de Asistentes */}
          <div className="lg:col-span-2">
            <Card className="shadow-md h-full min-h-[600px]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 sticky top-0 z-10">
                <CardTitle className="text-lg flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-600" />
                  Registro de Ingresos en Tiempo Real
                </CardTitle>
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-3 py-1 rounded-full font-bold animate-pulse flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  EN VIVO
                </span>
              </CardHeader>
              <CardContent className="p-0">
                {asistentes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Clock className="w-12 h-12 mb-4 opacity-20" />
                    <p>Esperando el primer ingreso...</p>
                    <p className="text-sm">Muestra el QR a los asambleístas para comenzar</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-4">Hora</th>
                          <th className="px-6 py-4">Unidad</th>
                          <th className="px-6 py-4">Propietario / Email</th>
                          <th className="px-6 py-4 text-right">Coeficiente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {asistentes.map((asistente) => (
                          <tr key={asistente.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors animate-in fade-in slide-in-from-top-1">
                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                              {new Date(asistente.hora_llegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-bold text-gray-900 dark:text-white">
                                {asistente.torre} - {asistente.numero}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900 dark:text-white">{asistente.nombre_propietario}</span>
                                <span className="text-xs text-gray-500 truncate max-w-[200px]">{asistente.email_propietario}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                              {asistente.coeficiente.toFixed(4)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
