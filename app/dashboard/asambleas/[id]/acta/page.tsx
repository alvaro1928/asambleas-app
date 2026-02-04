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

interface UnidadNoParticipo {
  id: string
  torre: string
  numero: string
  nombre_propietario: string | null
  email_propietario: string | null
  telefono_propietario: string | null
  coeficiente: number
}

/** Voto final de una unidad en una pregunta (para cuadro de auditoría de votaciones finales) */
interface VotoFinalUnidad {
  torre: string
  numero: string
  nombre_propietario: string | null
  opcion_texto: string
  coeficiente: number
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
  const [incluyeActaDetallada, setIncluyeActaDetallada] = useState(false)
  const [tokensDisponibles, setTokensDisponibles] = useState(0)
  const [costoOperacion, setCostoOperacion] = useState(0)
  const [unidadesNoParticipation, setUnidadesNoParticipation] = useState<UnidadNoParticipo[]>([])
  /** Por pregunta: lista de votos finales (una fila por unidad con su opción elegida) para el cuadro de auditoría */
  const [votacionesFinalesPorPregunta, setVotacionesFinalesPorPregunta] = useState<Record<string, VotoFinalUnidad[]>>({})

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
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (asambleaError || !asambleaData) {
        router.push('/dashboard/asambleas')
        return
      }
      setAsamblea(asambleaData)
      // Cobro único por asamblea: si ya se pagó (p. ej. al activar votación), mostrar acta sin puerta de cobro
      if (typeof window !== 'undefined' && (asambleaData as { pago_realizado?: boolean }).pago_realizado === true) {
        sessionStorage.setItem('acta_generada_' + params.id, '1')
        setActaGenerada(true)
      }

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', asambleaData.organization_id)
        .single()
      const org = orgData as { name?: string } | null
      setConjunto(org && typeof org.name === 'string' ? { name: org.name } : null)

      // Billetera por gestor: acceso si tiene tokens o si la asamblea ya fue pagada (cobro único)
      const orgId = asambleaData.organization_id
      const statusRes = await fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(orgId ?? '')}`)
      const statusData = statusRes.ok ? await statusRes.json() : null
      const yaPagada = (asambleaData as { pago_realizado?: boolean }).pago_realizado === true
      setIncluyeActaDetallada(!!statusData?.puede_operar || yaPagada)
      setTokensDisponibles(Math.max(0, Number(statusData?.tokens_disponibles ?? 0)))
      setCostoOperacion(Math.max(0, Number(statusData?.costo_operacion ?? 0)))

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

      // Votaciones finales por pregunta: una fila por unidad con su opción elegida (último voto por unidad)
      const votacionesFinalesMap: Record<string, VotoFinalUnidad[]> = {}
      for (const p of preguntasConOpciones) {
        const { data: votosPregunta } = await supabase
          .from('votos')
          .select('unidad_id, opcion_id, created_at')
          .eq('pregunta_id', p.id)
          .order('created_at', { ascending: false })
        // Quedarse con el último voto por unidad (created_at desc → primera aparición por unidad_id)
        const porUnidad = new Map<string, { opcion_id: string }>()
        for (const v of votosPregunta || []) {
          const uid = (v as { unidad_id?: string }).unidad_id
          const oid = (v as { opcion_id?: string }).opcion_id
          if (uid && oid && !porUnidad.has(uid)) porUnidad.set(uid, { opcion_id: oid })
        }
        const unidadIds = Array.from(porUnidad.keys())
        if (unidadIds.length === 0) {
          votacionesFinalesMap[p.id] = []
          continue
        }
        const { data: unidadesVotantes } = await supabase
          .from('unidades')
          .select('id, torre, numero, nombre_propietario, coeficiente')
          .in('id', unidadIds)
        const opcionesById = new Map(p.opciones.map((o) => [o.id, o.texto_opcion]))
        const lista: VotoFinalUnidad[] = (unidadesVotantes || []).map((u: any) => {
          const opcionId = porUnidad.get(u.id)?.opcion_id
          return {
            torre: u.torre ?? '',
            numero: u.numero ?? '',
            nombre_propietario: u.nombre_propietario ?? null,
            opcion_texto: opcionId ? (opcionesById.get(opcionId) ?? opcionId) : '—',
            coeficiente: Number(u.coeficiente) || 0,
          }
        })
        lista.sort((a, b) => `${a.torre}-${a.numero}`.localeCompare(`${b.torre}-${b.numero}`))
        votacionesFinalesMap[p.id] = lista
      }
      setVotacionesFinalesPorPregunta(votacionesFinalesMap)

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

      // Unidades que no votaron / no participaron: todas las unidades del conjunto menos las que tienen al menos un voto en alguna pregunta
      const preguntaIds = (preguntasConOpciones || []).map((p) => p.id)
      let unidadIdsVotaron: string[] = []
      if (preguntaIds.length > 0) {
        const { data: votosData } = await supabase
          .from('votos')
          .select('unidad_id')
          .in('pregunta_id', preguntaIds)
        unidadIdsVotaron = Array.from(new Set((votosData || []).map((v: any) => v.unidad_id).filter(Boolean)))
      }
      const { data: todasUnidades } = await supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, telefono_propietario, coeficiente')
        .eq('organization_id', asambleaData.organization_id)
      const setVotaron = new Set(unidadIdsVotaron)
      const noParticiparon = (todasUnidades || [])
        .filter((u: any) => !setVotaron.has(u.id))
        .map((u: any) => ({
          id: u.id,
          torre: u.torre ?? '',
          numero: u.numero ?? '',
          nombre_propietario: u.nombre_propietario ?? null,
          email_propietario: u.email_propietario ?? null,
          telefono_propietario: u.telefono_propietario ?? null,
          coeficiente: Number(u.coeficiente) || 0,
        }))
      setUnidadesNoParticipation(noParticiparon)
    } catch (e) {
      console.error(e)
      router.push('/dashboard/asambleas')
    } finally {
      setLoading(false)
    }
  }

  const [printError, setPrintError] = useState<string | null>(null)
  /** True cuando el usuario ya confirmó y se descontaron tokens por generar el acta (misma sesión no vuelve a cobrar) */
  const [actaGenerada, setActaGenerada] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [generarError, setGenerarError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id && typeof window !== 'undefined') {
      setActaGenerada(sessionStorage.getItem('acta_generada_' + params.id) === '1')
    }
  }, [params.id])

  /** Descontar tokens y marcar acta como generada; luego se puede imprimir sin volver a cobrar (Ctrl+P o botón). */
  const handleGenerarActa = async () => {
    if (!asamblea?.id) return
    setGenerarError(null)
    setGenerando(true)
    try {
      const res = await fetch('/api/dashboard/descontar-token-acta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ asamblea_id: asamblea.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402) {
        setGenerarError(data.error ?? `Saldo insuficiente: Necesitas ${costoOperacion} tokens y tienes ${tokensDisponibles}.`)
        setGenerando(false)
        return
      }
      if (!res.ok) {
        setGenerarError(data.error ?? 'Error al descontar tokens')
        setGenerando(false)
        return
      }
      if (data.tokens_restantes != null) setTokensDisponibles(Math.max(0, Number(data.tokens_restantes)))
      sessionStorage.setItem('acta_generada_' + params.id, '1')
      setActaGenerada(true)
    } catch (e) {
      setGenerarError('Error al procesar. Intenta de nuevo.')
    } finally {
      setGenerando(false)
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

  if (!incluyeActaDetallada) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
          <FileText className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Tokens insuficientes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Saldo insuficiente para esta operación. La descarga del acta con auditoría requiere tener en tu billetera al menos tantos tokens como unidades tiene el conjunto (1 token = 1 unidad). Recarga tokens o compra más para acceder.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Tu billetera: <strong>{tokensDisponibles} tokens</strong>
            {costoOperacion > 0 && <> • Costo por operación: {costoOperacion} tokens</>}
          </p>
          <Link href={`/dashboard/asambleas/${params.id}`}>
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a la asamblea
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Puerta: generar acta consume tokens; confirmar antes de mostrar el acta (luego pueden imprimir con Ctrl+P sin volver a cobrar)
  if (!actaGenerada) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 print:hidden">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 text-center">
          <FileText className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Generar acta
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            El cobro es <strong>solo al activar la asamblea</strong> (una vez). Si ya activaste, puedes generar el acta sin nuevo cobro. Una vez generada, podrás imprimir (Ctrl+P o botón) cuantas veces quieras.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Tu saldo: <strong>{tokensDisponibles} tokens</strong>
          </p>
          {generarError && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">{generarError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/dashboard/asambleas/${params.id}`}>
              <Button variant="outline">Cancelar</Button>
            </Link>
            <Button
              onClick={handleGenerarActa}
              disabled={generando}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {generando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sí, generar acta
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Barra de acciones: oculta al imprimir */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/asambleas/${params.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div className="flex items-center gap-2 rounded-3xl bg-slate-100 px-3 py-2 border border-slate-200">
            <span className="text-xs font-medium text-slate-600">Billetera:</span>
            <span className="text-sm font-bold text-indigo-600">{tokensDisponibles} tokens</span>
          </div>
          <p className="text-xs text-slate-500">
            Acta generada. Imprimir (Ctrl+P o botón) no consume más tokens.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {printError && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{printError}</p>
          )}
          <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / Guardar como PDF
          </Button>
        </div>
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
                            Mayoría necesaria ({pregunta.umbral_aprobacion}%) — Resultado: {aprobado ? 'Aprobado' : 'No aprobado'} (máx. {maxPct.toFixed(1)}%).
                          </p>
                        )
                      })()}
                    </div>
                  )}

                  {/* Cuadro de votaciones finales: una fila por unidad con su voto final + totales */}
                  {votacionesFinalesPorPregunta[pregunta.id] && votacionesFinalesPorPregunta[pregunta.id].length > 0 && (
                    <div className="ml-4 mt-4 text-xs overflow-x-auto">
                      <p className="font-semibold text-gray-700 mb-1">Votación final por unidad (auditoría — voto final de cada unidad y totales):</p>
                      <table className="min-w-full border border-gray-300 mt-1">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-2 py-1 text-left">Unidad</th>
                            <th className="border px-2 py-1 text-left">Propietario / Residente</th>
                            <th className="border px-2 py-1 text-left">Voto final</th>
                            <th className="border px-2 py-1 text-right">Coef. %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {votacionesFinalesPorPregunta[pregunta.id].map((row, i) => (
                            <tr key={i}>
                              <td className="border px-2 py-1">{row.torre}-{row.numero}</td>
                              <td className="border px-2 py-1">{row.nombre_propietario ?? '—'}</td>
                              <td className="border px-2 py-1">{row.opcion_texto}</td>
                              <td className="border px-2 py-1 text-right">{row.coeficiente.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {stats && stats.resultados && stats.resultados.length > 0 && (
                        <p className="mt-2 text-gray-600 font-medium">
                          Totales: {stats.resultados.map((r: any) => `${r.opcion_texto}: ${r.votos_cantidad ?? 0} unidad(es)`).join('; ')}.
                        </p>
                      )}
                    </div>
                  )}

                  {auditoria[pregunta.id] && auditoria[pregunta.id].length > 0 && (
                    <div className="ml-4 mt-3 text-xs overflow-x-auto">
                      <p className="font-semibold text-gray-700 mb-1">Detalle de auditoría — transacciones (cambios, quién votó, cuándo, dispositivo):</p>
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

        {unidadesNoParticipation.length > 0 && (
          <section className="mt-10 break-inside-avoid">
            <h2 className="text-lg font-bold uppercase mb-2">Unidades que no votaron o no participaron</h2>
            <p className="text-sm text-gray-600 mb-3">
              Detalle de las <strong>{unidadesNoParticipation.length}</strong> unidad{unidadesNoParticipation.length !== 1 ? 'es' : ''} que no registraron voto en ninguna pregunta de esta asamblea.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1.5 text-left font-semibold">Torre</th>
                    <th className="border px-2 py-1.5 text-left font-semibold">Número</th>
                    <th className="border px-2 py-1.5 text-left font-semibold">Propietario / Residente</th>
                    <th className="border px-2 py-1.5 text-left font-semibold">Email</th>
                    <th className="border px-2 py-1.5 text-left font-semibold">Teléfono</th>
                    <th className="border px-2 py-1.5 text-right font-semibold">Coeficiente %</th>
                  </tr>
                </thead>
                <tbody>
                  {unidadesNoParticipation.map((u) => (
                    <tr key={u.id}>
                      <td className="border px-2 py-1.5">{u.torre || '—'}</td>
                      <td className="border px-2 py-1.5">{u.numero || '—'}</td>
                      <td className="border px-2 py-1.5">{u.nombre_propietario || '—'}</td>
                      <td className="border px-2 py-1.5">{u.email_propietario || '—'}</td>
                      <td className="border px-2 py-1.5">{u.telefono_propietario || '—'}</td>
                      <td className="border px-2 py-1.5 text-right">{u.coeficiente.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Coeficiente total no participante: <strong>{unidadesNoParticipation.reduce((s, u) => s + u.coeficiente, 0).toFixed(2)}%</strong>.
            </p>
          </section>
        )}

        <footer className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-500">
          Documento generado como soporte de las votaciones. {new Date().toLocaleString('es-CO')}.
        </footer>
      </main>
    </div>
  )
}
