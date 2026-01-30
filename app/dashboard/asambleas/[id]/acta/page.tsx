'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, FileText, Printer, Loader2 } from 'lucide-react'
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
  umbral_aprobacion?: number | null
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

interface AuditRow {
  votante_email: string
  votante_nombre: string | null
  unidad_torre: string
  unidad_numero: string
  opcion_seleccionada: string
  es_poder: boolean
  accion: string
  opcion_anterior: string | null
  fecha_accion: string
  ip_address: string | null
  user_agent?: string | null
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
  const [auditoria, setAuditoria] = useState<Record<string, AuditRow[]>>({})
  const [planType, setPlanType] = useState<'free' | 'pro' | 'pilot'>('free')

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
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
        .select('name, plan_type')
        .eq('id', asambleaData.organization_id)
        .single()
      setConjunto(orgData || null)
      setPlanType((orgData?.plan_type as 'free' | 'pro' | 'pilot') ?? 'free')

      const { data: preguntasData } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, descripcion, tipo_votacion, estado, orden, umbral_aprobacion')
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

      const auditMap: Record<string, AuditRow[]> = {}
      for (const p of preguntasConOpciones) {
        try {
          const { data: auditData } = await supabase.rpc('reporte_auditoria_pregunta', {
            p_pregunta_id: p.id,
          })
          if (auditData && Array.isArray(auditData)) {
            auditMap[p.id] = auditData.map((r: any) => ({
              votante_email: r.votante_email ?? '',
              votante_nombre: r.votante_nombre ?? null,
              unidad_torre: r.unidad_torre ?? '',
              unidad_numero: r.unidad_numero ?? '',
              opcion_seleccionada: r.opcion_seleccionada ?? '',
              es_poder: !!r.es_poder,
              accion: r.accion ?? '',
              opcion_anterior: r.opcion_anterior ?? null,
              fecha_accion: r.fecha_accion ?? '',
              ip_address: r.ip_address ?? null,
              user_agent: r.user_agent ?? null,
            }))
          }
        } catch {
          auditMap[p.id] = []
        }
      }
      setAuditoria(auditMap)

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

  const planProUrl = process.env.NEXT_PUBLIC_PLAN_PRO_URL || '#'

  if (planType === 'free') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
          <FileText className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Acta y Auditoría en Plan Pro
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            La descarga del acta y el reporte de auditoría están disponibles en Plan Pro o Pilot. Actualiza tu plan para acceder.
          </p>
          <Link href={`/dashboard/asambleas/${params.id}`}>
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a la asamblea
            </Button>
          </Link>
          {planProUrl !== '#' && (
            <a href={planProUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                Disponible en Plan Pro — Contactar soporte / ventas
              </Button>
            </a>
          )}
        </div>
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
                      {pregunta.umbral_aprobacion != null && stats.resultados?.length > 0 && (() => {
                        const totalVotos = Number(stats.total_votos) || 0
                        const maxPct = pregunta.tipo_votacion === 'coeficiente'
                          ? Math.max(...(stats.resultados as any[]).map((r: any) => Number(r.porcentaje_coeficiente_total ?? r.porcentaje_coeficiente ?? 0)))
                          : Math.max(...(stats.resultados as any[]).map((r: any) => totalVotos > 0 ? ((Number(r.votos_cantidad) || 0) / totalVotos) * 100 : 0))
                        const aprobado = maxPct >= (pregunta.umbral_aprobacion ?? 0)
                        return (
                          <p className={`text-sm font-semibold mt-2 ${aprobado ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            Umbral: {pregunta.umbral_aprobacion}% — Resultado: {aprobado ? 'Aprobado' : 'No aprobado'} (máx. {maxPct.toFixed(1)}%).
                          </p>
                        )
                      })()}
                    </div>
                  )}
                  {auditoria[pregunta.id] && auditoria[pregunta.id].length > 0 && (
                    <div className="ml-4 mt-3 text-xs overflow-x-auto">
                      <p className="font-semibold text-gray-700 mb-1">Detalle de auditoría (quién votó, cuándo, dispositivo):</p>
                      <table className="min-w-full border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-2 py-1 text-left">Votante</th>
                            <th className="border px-2 py-1 text-left">Unidad</th>
                            <th className="border px-2 py-1 text-left">Opción</th>
                            <th className="border px-2 py-1 text-left">Acción</th>
                            <th className="border px-2 py-1 text-left">Fecha/hora</th>
                            <th className="border px-2 py-1 text-left">IP</th>
                            <th className="border px-2 py-1 text-left">Dispositivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditoria[pregunta.id].map((row, i) => (
                            <tr key={i}>
                              <td className="border px-2 py-1">{row.votante_email} {row.votante_nombre ? `(${row.votante_nombre})` : ''}</td>
                              <td className="border px-2 py-1">{row.unidad_torre}-{row.unidad_numero}{row.es_poder ? ' (poder)' : ''}</td>
                              <td className="border px-2 py-1">{row.opcion_seleccionada}</td>
                              <td className="border px-2 py-1">{row.accion}{row.opcion_anterior ? ` (antes: ${row.opcion_anterior})` : ''}</td>
                              <td className="border px-2 py-1">{row.fecha_accion ? new Date(row.fecha_accion).toLocaleString('es-CO') : '-'}</td>
                              <td className="border px-2 py-1">{row.ip_address || '-'}</td>
                              <td className="border px-2 py-1 max-w-[200px] truncate" title={row.user_agent || ''}>{row.user_agent || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
