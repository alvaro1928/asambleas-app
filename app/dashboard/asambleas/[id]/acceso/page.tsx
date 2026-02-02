'use client'

import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Users,
  QrCode,
  RefreshCw,
  Clock,
  Building2,
  Vote,
  CheckCircle2,
  Copy,
  Search,
  UserCheck,
  UserX,
  Radio,
  Maximize2,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QRCodeSVG } from 'qrcode.react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts'

interface Asamblea {
  id: string
  nombre: string
  codigo_acceso: string
  estado: string
  organization_id?: string
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

interface UnidadFila {
  id: string
  torre: string
  numero: string
  nombre_propietario: string
  email_propietario: string
  coeficiente: number
}

interface QuorumData {
  total_unidades: number
  unidades_votantes: number
  unidades_pendientes: number
  porcentaje_participacion_nominal: number
  porcentaje_participacion_coeficiente: number
  quorum_alcanzado: boolean
}

interface PreguntaAvance {
  id: string
  texto_pregunta: string
  total_votos: number
  total_coeficiente: number
  coeficiente_total_conjunto?: number
  umbral_aprobacion?: number | null
}

interface ResultadoOpcion {
  opcion_id: string
  opcion_texto: string
  color: string
  votos_cantidad: number
  votos_coeficiente: number
  porcentaje_coeficiente_total: number
}

interface PreguntaConResultados {
  id: string
  texto_pregunta: string
  umbral_aprobacion: number | null
  resultados: ResultadoOpcion[]
}

export default function AsambleaAccesoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [asistentes, setAsistentes] = useState<Asistente[]>([])
  const [yaVotaron, setYaVotaron] = useState<UnidadFila[]>([])
  const [faltantes, setFaltantes] = useState<UnidadFila[]>([])
  const [loading, setLoading] = useState(true)
  const [recargando, setRecargando] = useState(false)
  const [urlPublica, setUrlPublica] = useState('')
  const [quorum, setQuorum] = useState<QuorumData | null>(null)
  const [preguntasAvance, setPreguntasAvance] = useState<PreguntaAvance[]>([])
  const [preguntasConResultados, setPreguntasConResultados] = useState<PreguntaConResultados[]>([])
  const [searchSesion, setSearchSesion] = useState('')
  const [searchYaVotaron, setSearchYaVotaron] = useState('')
  const [searchFaltantes, setSearchFaltantes] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [graficaMaximizada, setGraficaMaximizada] = useState(false)
  const [tokensDisponibles, setTokensDisponibles] = useState<number>(0)
  const [totalUnidadesConjunto, setTotalUnidadesConjunto] = useState<number>(0)

  useEffect(() => {
    loadAsamblea()
    loadAsistentes()
    loadAvanceVotaciones()

    const interval = setInterval(() => {
      loadAsistentes(true)
      loadAvanceVotaciones()
    }, 10000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount and when id changes; loaders are stable
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
        .select('id, nombre, codigo_acceso, estado, organization_id')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (error) throw error
      setAsamblea(data)
      setUrlPublica(`${window.location.origin}/votar/${data.codigo_acceso}`)
      if (data.organization_id) {
        const res = await fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(data.organization_id)}`, { credentials: 'include' })
        if (res.ok) {
          const status = await res.json().catch(() => ({}))
          setTokensDisponibles(Math.max(0, Number(status.tokens_disponibles ?? 0)))
          setTotalUnidadesConjunto(Math.max(0, Number(status.unidades_conjunto ?? 0)))
        }
      }
    } catch (error) {
      console.error('Error cargando asamblea:', error)
      router.push('/dashboard/asambleas')
    }
  }

  const loadAsistentes = async (isPolling = false) => {
    if (!isPolling) setLoading(true)
    else setRecargando(true)

    try {
      const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const baseQuery = () =>
        supabase
          .from('quorum_asamblea')
          .select(`
            id, email_propietario, hora_llegada,
            unidades ( torre, numero, coeficiente, nombre_propietario )
          `)
          .eq('asamblea_id', params.id)
          .eq('presente_virtual', true)
          .order('hora_llegada', { ascending: false })

      let result = await baseQuery().gte('ultima_actividad', cincoMinAtras)
      if (result.error) result = await baseQuery()
      const { data, error } = result
      if (error) throw error

      const formatted: Asistente[] = (data || []).map((item: any) => ({
        id: item.id,
        email_propietario: item.email_propietario,
        nombre_propietario: item.unidades?.nombre_propietario || 'S/N',
        hora_llegada: item.hora_llegada,
        torre: item.unidades?.torre || 'S/T',
        numero: item.unidades?.numero || 'S/N',
        coeficiente: item.unidades?.coeficiente || 0
      }))
      setAsistentes(formatted)
    } catch (error) {
      console.error('Error cargando asistentes:', error)
    } finally {
      setLoading(false)
      setRecargando(false)
    }
  }

  const loadAvanceVotaciones = async () => {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('calcular_quorum_asamblea', {
        p_asamblea_id: params.id
      })

      if (!rpcError && rpcData?.length) {
        const q = rpcData[0] as QuorumData
        setQuorum({
          total_unidades: q.total_unidades ?? 0,
          unidades_votantes: q.unidades_votantes ?? 0,
          unidades_pendientes: q.unidades_pendientes ?? 0,
          porcentaje_participacion_nominal: q.porcentaje_participacion_nominal ?? 0,
          porcentaje_participacion_coeficiente: q.porcentaje_participacion_coeficiente ?? 0,
          quorum_alcanzado: q.quorum_alcanzado ?? false
        })
      } else setQuorum(null)

      const { data: preguntasData } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, umbral_aprobacion')
        .eq('asamblea_id', params.id)
        .eq('estado', 'abierta')
        .order('created_at', { ascending: true })

      const avances: PreguntaAvance[] = []
      const conResultados: PreguntaConResultados[] = []

      for (const p of preguntasData || []) {
        const { data: statsData } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: p.id
        })
        const s = statsData?.[0] as any
        const totalCoef = Number(s?.total_coeficiente) || 0
        const coefConjunto = s?.coeficiente_total_conjunto != null ? Number(s.coeficiente_total_conjunto) : undefined
        avances.push({
          id: p.id,
          texto_pregunta: p.texto_pregunta,
          total_votos: Number(s?.total_votos) || 0,
          total_coeficiente: totalCoef,
          coeficiente_total_conjunto: coefConjunto,
          umbral_aprobacion: p.umbral_aprobacion ?? null
        })

        let resultados: ResultadoOpcion[] = []
        if (s?.resultados) {
          const raw = typeof s.resultados === 'string' ? JSON.parse(s.resultados || '[]') : s.resultados
          resultados = (Array.isArray(raw) ? raw : []).map((r: any) => ({
            opcion_id: r.opcion_id,
            opcion_texto: r.opcion_texto || r.texto_opcion || 'Opción',
            color: r.color || '#6366f1',
            votos_cantidad: Number(r.votos_cantidad) || 0,
            votos_coeficiente: Number(r.votos_coeficiente) || 0,
            porcentaje_coeficiente_total: Number(r.porcentaje_coeficiente_total) || 0
          }))
        }
        conResultados.push({
          id: p.id,
          texto_pregunta: p.texto_pregunta,
          umbral_aprobacion: p.umbral_aprobacion ?? null,
          resultados
        })
      }
      setPreguntasAvance(avances)
      setPreguntasConResultados(conResultados)

      const orgId = asamblea?.organization_id
      if (!orgId) return

      const { data: votosData } = await supabase
        .from('votos')
        .select('unidad_id')
        .in('pregunta_id', (preguntasData || []).map((x) => x.id))

      const unidadIdsVotaron = Array.from(new Set((votosData || []).map((v: any) => v.unidad_id).filter(Boolean)))

      if (unidadIdsVotaron.length > 0) {
        const { data: unidadesVotaron } = await supabase
          .from('unidades')
          .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
          .in('id', unidadIdsVotaron)
        setYaVotaron((unidadesVotaron || []).map((u: any) => ({
          id: u.id,
          torre: u.torre || 'S/T',
          numero: u.numero || 'S/N',
          nombre_propietario: u.nombre_propietario || 'S/N',
          email_propietario: u.email_propietario || '',
          coeficiente: Number(u.coeficiente) || 0
        })))
      } else setYaVotaron([])

      const { data: todasUnidades } = await supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
        .eq('organization_id', orgId)

      const idsVotaronSet = new Set(unidadIdsVotaron)
      const faltantesList = (todasUnidades || []).filter((u: any) => !idsVotaronSet.has(u.id)).map((u: any) => ({
        id: u.id,
        torre: u.torre || 'S/T',
        numero: u.numero || 'S/N',
        nombre_propietario: u.nombre_propietario || 'S/N',
        email_propietario: u.email_propietario || '',
        coeficiente: Number(u.coeficiente) || 0
      }))
      setFaltantes(faltantesList)
    } catch (error) {
      console.error('Error cargando avance:', error)
    }
  }

  useEffect(() => {
    if (asamblea?.organization_id) loadAvanceVotaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when org id is available for yaVotaron/faltantes
  }, [asamblea?.organization_id])

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(urlPublica)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // ignore
    }
  }

  const filtro = (texto: string, query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return texto.toLowerCase().includes(q)
  }

  const asistentesFiltrados = useMemo(() => {
    if (!searchSesion.trim()) return asistentes
    return asistentes.filter(
      (a) =>
        filtro(`${a.torre} ${a.numero}`, searchSesion) ||
        filtro(a.nombre_propietario, searchSesion) ||
        filtro(a.email_propietario, searchSesion)
    )
  }, [asistentes, searchSesion])

  const yaVotaronFiltrados = useMemo(() => {
    if (!searchYaVotaron.trim()) return yaVotaron
    return yaVotaron.filter(
      (u) =>
        filtro(`${u.torre} ${u.numero}`, searchYaVotaron) ||
        filtro(u.nombre_propietario, searchYaVotaron) ||
        filtro(u.email_propietario, searchYaVotaron)
    )
  }, [yaVotaron, searchYaVotaron])

  const yaVotaronIds = useMemo(() => new Set(yaVotaron.map((u) => u.id)), [yaVotaron])
  const pendientes = useMemo(
    () => asistentes.filter((a) => !yaVotaronIds.has(a.id)),
    [asistentes, yaVotaronIds]
  )
  const pendientesFiltrados = useMemo(() => {
    if (!searchFaltantes.trim()) return pendientes
    return pendientes.filter(
      (u) =>
        filtro(`${u.torre} ${u.numero}`, searchFaltantes) ||
        filtro(u.nombre_propietario, searchFaltantes) ||
        filtro(u.email_propietario, searchFaltantes)
    )
  }, [pendientes, searchFaltantes])

  if (loading && !asamblea) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0E14' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando control de acceso...</p>
        </div>
      </div>
    )
  }

  const saldoInsuficiente = totalUnidadesConjunto > 0 && tokensDisponibles < totalUnidadesConjunto

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0B0E14' }}>
      <header className="shadow-sm border-b border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: '#0B0E14' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Link
                href={`/dashboard/asambleas/${params.id}`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control de Acceso y Votaciones</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{asamblea?.nombre}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadAsistentes(true)
                loadAvanceVotaciones()
              }}
              disabled={recargando}
              className="rounded-2xl border-gray-200 dark:border-[rgba(255,255,255,0.1)]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${recargando ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          {saldoInsuficiente && (
            <div className="mb-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 font-semibold">Saldo insuficiente para procesar esta asamblea.</span>
              <span className="text-slate-300 text-sm">Billetera: {tokensDisponibles} tokens · Se requieren {totalUnidadesConjunto} para esta operación.</span>
            </div>
          )}

          {/* Link de votación: contenedor destacado parte superior central, fuente legible, Copiar Enlace con icono */}
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.1)] px-4 py-4 mb-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
            <label className="sr-only">Enlace de votación</label>
            <input
              type="text"
              readOnly
              value={urlPublica}
              className="flex-1 min-w-0 px-4 py-3 text-base sm:text-lg bg-white/5 border border-[rgba(255,255,255,0.1)] rounded-2xl text-slate-200 truncate font-sans"
              style={{ color: '#e2e8f0' }}
              aria-label="URL de votación"
            />
            <Button
              onClick={copiarEnlace}
              className="shrink-0 rounded-2xl font-semibold bg-white text-slate-800 hover:bg-slate-100 border border-[rgba(255,255,255,0.1)] flex items-center justify-center gap-2 py-3 px-5"
              title="Copiar enlace al portapapeles"
            >
              <Copy className="w-5 h-5" />
              {copiado ? '¡Copiado!' : 'Copiar Enlace'}
            </Button>
          </div>

          {/* Pregunta por la que están votando — en grande debajo del enlace */}
          {preguntasConResultados.length > 0 && (
            <div className="max-w-4xl mx-auto mt-4 px-2">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Pregunta en votación
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-snug">
                {preguntasConResultados.length === 1
                  ? preguntasConResultados[0].texto_pregunta
                  : preguntasConResultados.map((p, i) => (
                      <span key={p.id}>
                        {i + 1}. {p.texto_pregunta}
                        {i < preguntasConResultados.length - 1 && ' · '}
                      </span>
                    ))}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ backgroundColor: '#0B0E14' }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: QR + Resumen */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-2xl border border-[rgba(255,255,255,0.1)] overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
              <CardHeader className="bg-indigo-600 text-white py-4">
                <CardTitle className="text-lg flex items-center">
                  <QrCode className="w-5 h-5 mr-2" />
                  Código QR de Acceso
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-100 mb-4">
                  {urlPublica && (
                    <QRCodeSVG value={urlPublica} size={180} level="H" includeMargin />
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                  Los asambleístas deben escanear este código para ingresar a la votación.
                </p>
                <p className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 py-2 px-4 rounded-lg">
                  CÓDIGO: {asamblea?.codigo_acceso}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-slate-900/50 dark:bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-md flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-gray-500" />
                  Resumen de Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Unidades con sesión activa</span>
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

          {/* Triple panel: Sesión Activa | Ya Votaron | Pendientes (Faltantes) */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-12rem)] min-h-[480px]">
              {/* Sesión Activa: unidades con ping de quórum activo */}
              <Card className="flex flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0 bg-green-50 dark:bg-green-900/20">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-green-600" />
                      Sesión Activa
                    </CardTitle>
                    <span className="text-xs font-bold text-green-700 dark:text-green-400 bg-green-200 dark:bg-green-800/50 px-2 py-0.5 rounded-full">
                      EN VIVO
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Conectados ahora (ping quórum)
                  </p>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Buscar..."
                      value={searchSesion}
                      onChange={(e) => setSearchSesion(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {asistentesFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Esperando el primer ingreso...
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {asistentesFiltrados.map((a) => (
                          <li key={a.id} className="px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <div className="font-medium text-gray-900 dark:text-white">{a.torre} - {a.numero}</div>
                            <div className="text-gray-600 dark:text-gray-400 truncate">{a.nombre_propietario}</div>
                            <div className="text-xs text-gray-500 truncate">{a.email_propietario}</div>
                            <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{a.coeficiente.toFixed(2)}%</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Ya Votaron: unidades con registro en tabla votos para la pregunta actual */}
              <Card className="flex flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-slate-200">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    Ya Votaron
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-1">
                    Tienen registro en votos
                  </p>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Buscar..."
                      value={searchYaVotaron}
                      onChange={(e) => setSearchYaVotaron(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {yaVotaronFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">Ninguna unidad ha votado aún.</div>
                    ) : (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {yaVotaronFiltrados.map((u) => (
                          <li key={u.id} className="px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <div className="font-medium text-gray-900 dark:text-white">{u.torre} - {u.numero}</div>
                            <div className="text-gray-600 dark:text-gray-400 truncate">{u.nombre_propietario}</div>
                            <div className="text-xs text-gray-500 truncate">{u.email_propietario}</div>
                            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{u.coeficiente.toFixed(2)}%</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pendientes (Faltantes): (Unidades en Quórum) − (Ya votaron) — prioridad para el Gestor */}
              <Card className="flex flex-col overflow-hidden rounded-2xl border border-amber-500/50 border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0 bg-amber-50 dark:bg-amber-900/20">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                    <UserX className="w-4 h-4" />
                    Pendientes (Faltantes)
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Conectados y aún no votan — prioridad para presionar votación
                  </p>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Buscar..."
                      value={searchFaltantes}
                      onChange={(e) => setSearchFaltantes(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {pendientesFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 flex items-center gap-2 justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Ningún conectado pendiente de votar.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {pendientesFiltrados.map((u) => (
                          <li key={u.id} className="px-4 py-2 text-sm hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                            <div className="font-medium text-gray-900 dark:text-white">{u.torre} - {u.numero}</div>
                            <div className="text-gray-600 dark:text-gray-400 truncate">{u.nombre_propietario}</div>
                            <div className="text-xs text-gray-500 truncate">{u.email_propietario}</div>
                            <div className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-0.5">{u.coeficiente.toFixed(2)}%</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gráfica de votación Pro: barras horizontales Recharts, % coeficiente + número de votos, umbral, badge MAYORÍA ALCANZADA */}
          {preguntasConResultados.length > 0 && (
            <Card className="mt-6 rounded-2xl border border-[rgba(255,255,255,0.1)] overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.1)] py-4 px-6">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Vote className="w-5 h-5 text-emerald-500" />
                    Avance de votaciones (coeficiente)
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Línea vertical = Umbral de Aprobación Legal. Se actualiza cada 10 s.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGraficaMaximizada(true)}
                  className="shrink-0 rounded-xl border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  title="Ver gráfica en grande (pop-up)"
                >
                  <Maximize2 className="w-4 h-4 mr-1" />
                  Ver grande
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {quorum && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Unidades que ya votaron</span>
                    <span className="font-bold">{quorum.unidades_votantes} / {quorum.total_unidades}</span>
                  </div>
                )}
                {preguntasConResultados.map((preg) => {
                  const data = preg.resultados.map((r) => ({
                    name: r.opcion_texto.length > 24 ? r.opcion_texto.slice(0, 22) + '…' : r.opcion_texto,
                    fullName: r.opcion_texto,
                    porcentaje: Math.round(r.porcentaje_coeficiente_total * 100) / 100,
                    votosCantidad: Number(r.votos_cantidad) || 0,
                    color: r.color,
                    aprueba: preg.umbral_aprobacion != null && r.porcentaje_coeficiente_total >= preg.umbral_aprobacion
                  }))
                  const umbral = preg.umbral_aprobacion ?? 51
                  return (
                    <div key={preg.id} className="space-y-3">
                      <p className="text-base font-semibold text-slate-200 line-clamp-2">
                        {preg.texto_pregunta}
                      </p>
                      <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={data}
                            margin={{ top: 12, right: 90, left: 100, bottom: 12 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 13, fill: '#94a3b8' }} />
                            <Tooltip
                              formatter={(value: number | undefined, _name?: string, props?: unknown) => {
                                const payload = (props as { payload?: { votosCantidad?: number } })?.payload
                                const votos = payload?.votosCantidad ?? 0
                                return [`${value ?? 0}% (${votos} ${votos !== 1 ? 'votos' : 'voto'})`, 'Coeficiente']
                              }}
                              labelFormatter={(_: ReactNode, payload: readonly { payload?: { fullName?: string } }[]) => payload?.[0]?.payload?.fullName ?? ''}
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            />
                            <ReferenceLine
                              x={umbral}
                              stroke={data.some((d) => d.aprueba) ? '#10b981' : '#f59e0b'}
                              strokeWidth={2}
                              strokeDasharray="4 2"
                              label={{ value: `Umbral ${umbral}%`, position: 'insideTopRight', fill: '#94a3b8', fontSize: 11 }}
                            />
                            <Bar
                              dataKey="porcentaje"
                              radius={[0, 6, 6, 0]}
                              maxBarSize={40}
                              label={{
                                position: 'right',
                                formatter: (label: unknown, ...args: unknown[]) => {
                                  const v = Number(label ?? 0)
                                  const payload = (args[0] as { payload?: { aprueba?: boolean; votosCantidad?: number } })?.payload
                                  const votos = payload?.votosCantidad ?? 0
                                  const suf = votos !== 1 ? 'votos' : 'voto'
                                  if (payload?.aprueba) return `${v}% (${votos} ${suf}) MAYORÍA ALCANZADA`
                                  return `${v}% (${votos} ${suf})`
                                },
                                fontSize: 12,
                                fill: '#e2e8f0'
                              }}
                            >
                              {data.map((entry, index) => (
                                <Cell
                                  key={entry.name + index}
                                  fill={entry.aprueba ? '#10b981' : entry.color}
                                  stroke={entry.aprueba ? '#059669' : undefined}
                                  strokeWidth={entry.aprueba ? 2 : 0}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {data.some((d) => d.aprueba) && (
                        <div className="flex flex-wrap gap-2">
                          {data.filter((d) => d.aprueba).map((d, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold text-emerald-200 bg-emerald-900/40 border border-emerald-600"
                              style={{ boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' }}
                            >
                              MAYORÍA ALCANZADA — {d.name}: {d.porcentaje}% ({d.votosCantidad} {d.votosCantidad !== 1 ? 'votos' : 'voto'})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Modal: gráfica de avance en grande (pop-up) */}
      <Dialog open={graficaMaximizada} onOpenChange={setGraficaMaximizada}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-y-auto p-8 rounded-2xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: '#0B0E14' }}>
          <DialogHeader className="flex flex-row items-center justify-between gap-4 pr-10">
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-100">
              <Vote className="w-6 h-6 text-emerald-500" />
              Avance de votaciones (vista grande)
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setGraficaMaximizada(false)}
              className="absolute right-4 top-4"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogHeader>
          <div className="space-y-10 pt-4">
            {quorum && (
              <div className="flex justify-between text-lg">
                <span className="text-gray-600 dark:text-gray-400">Unidades que ya votaron</span>
                <span className="font-bold text-xl">
                  {quorum.unidades_votantes} / {quorum.total_unidades}
                </span>
              </div>
            )}
            {preguntasConResultados.map((preg) => {
              const data = preg.resultados.map((r) => ({
                name: r.opcion_texto.length > 28 ? r.opcion_texto.slice(0, 26) + '…' : r.opcion_texto,
                fullName: r.opcion_texto,
                porcentaje: Math.round(r.porcentaje_coeficiente_total * 100) / 100,
                votosCantidad: Number(r.votos_cantidad) || 0,
                color: r.color,
                aprueba: preg.umbral_aprobacion != null && r.porcentaje_coeficiente_total >= preg.umbral_aprobacion
              }))
              const umbral = preg.umbral_aprobacion ?? 51
              return (
                <div key={preg.id} className="space-y-4">
                  <p className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
                    {preg.texto_pregunta}
                  </p>
                  <div className="min-h-[50vh] h-[55vh] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={data}
                        margin={{ top: 16, right: 120, left: 140, bottom: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 18, fill: '#94a3b8' }} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 18, fill: '#94a3b8' }} />
                        <Tooltip
                          formatter={(value: number | undefined, _n?: string, props?: unknown) => {
                            const payload = (props as { payload?: { votosCantidad?: number } })?.payload
                            const votos = payload?.votosCantidad ?? 0
                            return [`${value ?? 0}% (${votos} ${votos !== 1 ? 'votos' : 'voto'})`, 'Coeficiente']
                          }}
                          labelFormatter={(_: ReactNode, payload: readonly { payload?: { fullName?: string } }[]) => payload?.[0]?.payload?.fullName ?? ''}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        />
                        <ReferenceLine
                          x={umbral}
                          stroke={data.some((d) => d.aprueba) ? '#10b981' : '#f59e0b'}
                          strokeWidth={2}
                          strokeDasharray="4 2"
                          label={{ value: `Umbral ${umbral}%`, position: 'insideTopRight', fill: '#94a3b8', fontSize: 14 }}
                        />
                        <Bar
                          dataKey="porcentaje"
                          radius={[0, 8, 8, 0]}
                          maxBarSize={56}
                          label={{
                            position: 'right',
                            formatter: (label: unknown, ...args: unknown[]) => {
                              const v = Number(label ?? 0)
                              const payload = (args[0] as { payload?: { aprueba?: boolean; votosCantidad?: number } })?.payload
                              const votos = payload?.votosCantidad ?? 0
                              const suf = votos !== 1 ? 'votos' : 'voto'
                              if (payload?.aprueba) return `${v}% (${votos} ${suf}) MAYORÍA ALCANZADA`
                              return `${v}% (${votos} ${suf})`
                            },
                            fontSize: 18,
                            fill: '#e2e8f0'
                          }}
                        >
                          {data.map((entry, index) => (
                            <Cell
                              key={entry.name + index}
                              fill={entry.aprueba ? '#10b981' : entry.color}
                              stroke={entry.aprueba ? '#059669' : undefined}
                              strokeWidth={entry.aprueba ? 2 : 0}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {data.some((d) => d.aprueba) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.filter((d) => d.aprueba).map((d, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-4 py-2 rounded-xl text-base font-bold text-emerald-200 bg-emerald-900/40 border border-emerald-600"
                          style={{ boxShadow: '0 0 16px rgba(16, 185, 129, 0.5)' }}
                        >
                          MAYORÍA ALCANZADA — {d.fullName}: {d.porcentaje}% ({d.votosCantidad} {d.votosCantidad !== 1 ? 'votos' : 'voto'})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
