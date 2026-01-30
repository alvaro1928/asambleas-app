'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, FileText, Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Asamblea {
  id: string
  nombre: string
  fecha: string
  estado: string
  organization_id: string
}

interface Conjunto {
  name: string
}

interface Pregunta {
  id: string
  texto_pregunta: string
  descripcion?: string
  tipo_votacion: string
  estado: string
  orden: number
}

interface Opcion {
  id: string
  texto_opcion: string
  color: string
  orden: number
}

interface StatsPregunta {
  total_votos: number
  total_coeficiente: number
  coeficiente_total_conjunto?: number
  porcentaje_participacion?: number
  resultados: Array<{
    opcion_id: string
    opcion_texto: string
    color: string
    votos_cantidad?: number
    votos_coeficiente?: number
    porcentaje_coeficiente_total?: number
    porcentaje_coeficiente?: number
  }>
}

interface Quorum {
  total_unidades: number
  unidades_votantes: number
  coeficiente_votante: number
  porcentaje_participacion_coeficiente: number
  quorum_alcanzado: boolean
}

export default function ActaPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [conjunto, setConjunto] = useState<Conjunto | null>(null)
  const [preguntas, setPreguntas] = useState<(Pregunta & { opciones: Opcion[] })[]>([])
  const [estadisticas, setEstadisticas] = useState<Record<string, StatsPregunta>>({})
  const [quorum, setQuorum] = useState<Quorum | null>(null)
  const [totalPoderes, setTotalPoderes] = useState(0)
  const [coefPoderes, setCoefPoderes] = useState(0)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    try {
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        router.push('/dashboard')
        return
      }

      const { data: asambleaData, error: asambleaError } = await supabase
        .from('asambleas')
        .select('id, nombre, fecha, estado, organization_id')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (asambleaError || !asambleaData) {
        router.push('/dashboard/asambleas')
        return
      }
      setAsamblea(asambleaData)

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', asambleaData.organization_id)
        .single()
      setConjunto(orgData || null)

      const { data: preguntasData } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, descripcion, tipo_votacion, estado, orden')
        .eq('asamblea_id', params.id)
        .order('orden', { ascending: true })

      const preguntasConOpciones: (Pregunta & { opciones: Opcion[] })[] = []
      const statsMap: Record<string, StatsPregunta> = {}

      for (const p of preguntasData || []) {
        const { data: opcionesData } = await supabase
          .from('opciones_pregunta')
          .select('id, texto_opcion, color, orden')
          .eq('pregunta_id', p.id)
          .order('orden', { ascending: true })

        preguntasConOpciones.push({
          ...p,
          opciones: opcionesData || [],
        })

        const { data: statsData } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: p.id,
        })
        if (statsData && statsData[0]) {
          const s = statsData[0] as any
          let resultados = []
          if (typeof s.resultados === 'string') {
            try {
              resultados = JSON.parse(s.resultados)
            } catch {
              resultados = []
            }
          } else if (Array.isArray(s.resultados)) {
            resultados = s.resultados
          } else {
            resultados = s.resultados || []
          }
          statsMap[p.id] = {
            total_votos: parseInt(s.total_votos) || 0,
            total_coeficiente: parseFloat(s.total_coeficiente) || 0,
            coeficiente_total_conjunto: parseFloat(s.coeficiente_total_conjunto) || 100,
            porcentaje_participacion: parseFloat(s.porcentaje_participacion) || 0,
            resultados,
          }
        }
      }
      setPreguntas(preguntasConOpciones)
      setEstadisticas({ ...statsMap })

      const { data: quorumData } = await supabase.rpc('calcular_quorum_asamblea', {
        p_asamblea_id: params.id,
      })
      if (quorumData && quorumData[0]) {
        setQuorum(quorumData[0] as Quorum)
      }

      const { data: poderesData } = await supabase
        .from('poderes')
        .select('id, unidad_otorgante_id')
        .eq('asamblea_id', params.id)
        .eq('estado', 'activo')

      const unidadIds = (poderesData || []).map((p: any) => p.unidad_otorgante_id)
      let coef = 0
      if (unidadIds.length > 0) {
        const { data: unids } = await supabase
          .from('unidades')
          .select('coeficiente')
          .in('id', unidadIds)
        coef = (unids || []).reduce((sum: number, u: any) => sum + (u.coeficiente || 0), 0)
      }
      setTotalPoderes(poderesData?.length || 0)
      setCoefPoderes(coef)
    } catch (e) {
      console.error(e)
      router.push('/dashboard/asambleas')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 print:hidden">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Barra de acciones: oculta al imprimir */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 flex items-center justify-between print:hidden">
        <Link href={`/dashboard/asambleas/${params.id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
        <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir / Guardar como PDF
        </Button>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-10 print:py-6">
        <header className="text-center border-b-2 border-gray-800 pb-6 mb-8">
          <h1 className="text-2xl font-bold uppercase tracking-wide">Acta de votación</h1>
          <p className="text-lg mt-2 font-semibold">{asamblea?.nombre}</p>
          <p className="text-sm text-gray-600 mt-1">{conjunto?.name}</p>
          <p className="text-sm text-gray-600 mt-1">{asamblea?.fecha && formatFecha(asamblea.fecha)}</p>
        </header>

        {quorum && (
          <section className="mb-8">
            <h2 className="text-lg font-bold uppercase mb-2">Quórum y participación</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <p><strong>Unidades que votaron:</strong> {quorum.unidades_votantes} / {quorum.total_unidades}</p>
              <p><strong>Coeficiente votante:</strong> {Number(quorum.coeficiente_votante).toFixed(2)}%</p>
              <p><strong>Participación (coeficiente):</strong> {Number(quorum.porcentaje_participacion_coeficiente).toFixed(2)}%</p>
              <p><strong>Quórum alcanzado:</strong> {quorum.quorum_alcanzado ? 'Sí' : 'No'}</p>
            </div>
          </section>
        )}

        {totalPoderes > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold uppercase mb-2">Poderes</h2>
            <p className="text-sm">
              Unidades con poder registrado: <strong>{totalPoderes}</strong>. Coeficiente delegado: <strong>{coefPoderes.toFixed(2)}%</strong>.
            </p>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold uppercase mb-4">Resultados por pregunta</h2>
          <div className="space-y-8">
            {preguntas.map((pregunta, idx) => {
              const stats = estadisticas[pregunta.id]
              return (
                <div key={pregunta.id} className="break-inside-avoid">
                  <h3 className="font-bold text-base mb-2">
                    Pregunta {idx + 1}. {pregunta.texto_pregunta}
                  </h3>
                  {pregunta.descripcion && (
                    <p className="text-sm text-gray-600 mb-2">{pregunta.descripcion}</p>
                  )}
                  <p className="text-xs text-gray-500 mb-2">
                    Tipo: {pregunta.tipo_votacion}. Estado: {pregunta.estado}.
                  </p>
                  {stats && (
                    <div className="ml-4 space-y-2">
                      <p className="text-sm">
                        Total votos: <strong>{stats.total_votos}</strong>. Coeficiente votante: <strong>{Number(stats.total_coeficiente).toFixed(2)}%</strong>.
                      </p>
                      <ul className="list-disc list-inside text-sm">
                        {stats.resultados?.map((r: any) => (
                          <li key={r.opcion_id}>
                            {r.opcion_texto}: {Number(r.porcentaje_coeficiente_total ?? r.porcentaje_coeficiente ?? 0).toFixed(2)}%
                            {r.votos_cantidad != null && ` (${r.votos_cantidad} voto(s))`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-500">
          Documento generado como soporte de las votaciones. {new Date().toLocaleString('es-CO')}.
        </footer>
      </main>
    </div>
  )
}
