'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
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
import type { BarChartData } from '@/components/charts/VotacionBarChart'

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })),
  {
    ssr: false,
    loading: () => <div className="w-[180px] h-[180px] bg-gray-200 dark:bg-gray-700 animate-pulse rounded-xl" />,
  }
)

const VotacionBarChart = dynamic(
  () => import('@/components/charts/VotacionBarChart'),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-800/40 animate-pulse rounded-xl" />,
  }
)

interface Asamblea {
  id: string
  nombre: string
  codigo_acceso: string
  estado: string
  organization_id?: string
  is_demo?: boolean
  sandbox_usar_unidades_reales?: boolean
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
  porcentaje_nominal_total?: number
}

interface PreguntaConResultados {
  id: string
  texto_pregunta: string
  tipo_votacion?: string
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
  const [esMobile, setEsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const fn = () => setEsMobile(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  const [tokensDisponibles, setTokensDisponibles] = useState<number>(0)
  const [totalUnidadesConjunto, setTotalUnidadesConjunto] = useState<number>(0)
  const [verificacionActiva, setVerificacionActiva] = useState(false)
  const [toggling, setToggling] = useState(false)
  interface VerificacionStats {
    total_verificados: number
    coeficiente_verificado: number
    porcentaje_verificado: number
    quorum_alcanzado: boolean
  }
  const [statsVerificacion, setStatsVerificacion] = useState<VerificacionStats | null>(null)

  // Modal registro manual de asistencia
  interface UnidadConAsistencia extends UnidadFila {
    ya_verifico: boolean
  }
  const [showModalAsistencia, setShowModalAsistencia] = useState(false)
  const [unidadesParaAsistencia, setUnidadesParaAsistencia] = useState<UnidadConAsistencia[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [busquedaAsistencia, setBusquedaAsistencia] = useState('')
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false)
  const [cargandoUnidadesAsistencia, setCargandoUnidadesAsistencia] = useState(false)

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
        .select('id, nombre, codigo_acceso, estado, organization_id, is_demo, sandbox_usar_unidades_reales, verificacion_asistencia_activa')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (error) throw error
      setAsamblea(data)
      setVerificacionActiva(!!(data as any).verificacion_asistencia_activa)
      const siteUrl = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '') : 'https://www.asamblea.online'
      setUrlPublica(`${siteUrl}/votar/${data.codigo_acceso}`)
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
        .select('id, texto_pregunta, umbral_aprobacion, tipo_votacion')
        .eq('asamblea_id', params.id)
        .eq('estado', 'abierta')
        .eq('is_archived', false)
        .order('created_at', { ascending: true })

      const avances: PreguntaAvance[] = []
      const conResultados: PreguntaConResultados[] = []

      for (const p of preguntasData || []) {
        const { data: statsData } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: p.id
        })
        const s = statsData?.[0] as any
        const tipoVotRpc = (s?.tipo_votacion ?? 'coeficiente') as string
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
            porcentaje_coeficiente_total: Number(r.porcentaje_coeficiente_total) || 0,
            porcentaje_nominal_total: Number(r.porcentaje_nominal_total ?? 0) || 0
          }))
        }
        const tipoVot = tipoVotRpc || (p as { tipo_votacion?: string }).tipo_votacion || 'coeficiente'
        conResultados.push({
          id: p.id,
          texto_pregunta: p.texto_pregunta,
          tipo_votacion: tipoVot,
          umbral_aprobacion: p.umbral_aprobacion ?? null,
          resultados
        })
      }
      setPreguntasAvance(avances)
      setPreguntasConResultados(conResultados)

      // Cargar stats de verificación de quórum
      const { data: verData } = await supabase.rpc('calcular_verificacion_quorum', {
        p_asamblea_id: params.id
      })
      if (verData?.length) {
        const v = verData[0] as VerificacionStats
        setStatsVerificacion({
          total_verificados: Number(v.total_verificados) || 0,
          coeficiente_verificado: Number(v.coeficiente_verificado) || 0,
          porcentaje_verificado: Number(v.porcentaje_verificado) || 0,
          quorum_alcanzado: !!v.quorum_alcanzado,
        })
      } else {
        setStatsVerificacion(null)
      }

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

      const soloUnidadesDemo = asamblea?.is_demo === true && !(asamblea?.sandbox_usar_unidades_reales === true)
      let queryUnidades = supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
        .eq('organization_id', orgId)
      queryUnidades = soloUnidadesDemo ? queryUnidades.eq('is_demo', true) : queryUnidades.or('is_demo.eq.false,is_demo.is.null')
      const { data: todasUnidades } = await queryUnidades

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

  const toggleVerificacion = async () => {
    if (toggling) return
    setToggling(true)
    try {
      const nuevoValor = !verificacionActiva
      const { error } = await supabase
        .from('asambleas')
        .update({ verificacion_asistencia_activa: nuevoValor })
        .eq('id', params.id)
      if (!error) {
        setVerificacionActiva(nuevoValor)
        if (!nuevoValor) {
          // Al desactivar limpiar stats para mostrar 0 cuando se reactive
        }
      }
    } finally {
      setToggling(false)
    }
  }

  const abrirModalAsistencia = async () => {
    if (!asamblea?.organization_id) return
    setShowModalAsistencia(true)
    setCargandoUnidadesAsistencia(true)
    setSeleccionadas(new Set())
    setBusquedaAsistencia('')
    try {
      const soloDemo = asamblea?.is_demo === true && !(asamblea?.sandbox_usar_unidades_reales === true)
      let q = supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
        .eq('organization_id', asamblea.organization_id)
        .order('torre', { ascending: true })
        .order('numero', { ascending: true })
      q = soloDemo ? q.eq('is_demo', true) : q.or('is_demo.eq.false,is_demo.is.null')
      const { data: todas } = await q

      const { data: verificadas } = await supabase
        .from('quorum_asamblea')
        .select('unidad_id')
        .eq('asamblea_id', params.id)
        .eq('verifico_asistencia', true)

      const verificadasSet = new Set((verificadas || []).map((v: any) => v.unidad_id))

      setUnidadesParaAsistencia(
        (todas || []).map((u: any) => ({
          id: u.id,
          torre: u.torre || 'S/T',
          numero: u.numero || 'S/N',
          nombre_propietario: u.nombre_propietario || 'S/N',
          email_propietario: u.email_propietario || '',
          coeficiente: Number(u.coeficiente) || 0,
          ya_verifico: verificadasSet.has(u.id),
        }))
      )
    } finally {
      setCargandoUnidadesAsistencia(false)
    }
  }

  const guardarAsistenciaManual = async () => {
    if (seleccionadas.size === 0 || guardandoAsistencia) return
    setGuardandoAsistencia(true)
    try {
      const res = await fetch('/api/registrar-asistencia-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: params.id, unidad_ids: Array.from(seleccionadas) }),
      })
      const data = await res.json()
      if (data.ok) {
        // Marcarlas como verificadas en la lista local
        setUnidadesParaAsistencia((prev) =>
          prev.map((u) => (seleccionadas.has(u.id) ? { ...u, ya_verifico: true } : u))
        )
        setSeleccionadas(new Set())
        // Refrescar stats
        await loadAvanceVotaciones()
      }
    } finally {
      setGuardandoAsistencia(false)
    }
  }

  const toggleUnidad = (id: string) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSeleccionarTodas = () => {
    const filtradas = unidadesParaAsistencia.filter((u) => {
      if (u.ya_verifico) return false
      if (!busquedaAsistencia.trim()) return true
      const q = busquedaAsistencia.toLowerCase()
      return (
        `${u.torre} ${u.numero}`.toLowerCase().includes(q) ||
        u.nombre_propietario.toLowerCase().includes(q)
      )
    })
    const idsVisibles = filtradas.map((u) => u.id)
    const todasSeleccionadas = idsVisibles.every((id) => seleccionadas.has(id))
    if (todasSeleccionadas) {
      setSeleccionadas((prev) => {
        const next = new Set(prev)
        idsVisibles.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSeleccionadas((prev) => {
        const next = new Set(prev)
        idsVisibles.forEach((id) => next.add(id))
        return next
      })
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
  // Pendientes (Faltantes): todas las unidades que no han votado (con o sin sesión), para localizar y alcanzar quórum
  const faltantesFiltrados = useMemo(() => {
    if (!searchFaltantes.trim()) return faltantes
    return faltantes.filter(
      (u) =>
        filtro(`${u.torre} ${u.numero}`, searchFaltantes) ||
        filtro(u.nombre_propietario, searchFaltantes) ||
        filtro(u.email_propietario, searchFaltantes)
    )
  }, [faltantes, searchFaltantes])

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
              className="rounded-3xl border-gray-200 dark:border-[rgba(255,255,255,0.1)]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${recargando ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          {saldoInsuficiente && (
            <div className="mb-4 rounded-3xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 font-semibold">Saldo insuficiente para procesar esta asamblea.</span>
              <span className="text-slate-300 text-sm">Billetera: {tokensDisponibles} tokens (créditos) · Se requieren {totalUnidadesConjunto} para esta operación.</span>
            </div>
          )}

          {/* Verificación de Quórum: toggle + widget de stats */}
          <div className="w-full mb-4 space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-3xl border px-4 py-3"
              style={{ backgroundColor: verificacionActiva ? 'rgba(21,128,61,0.15)' : 'rgba(15,23,42,0.6)', borderColor: verificacionActiva ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 shrink-0" style={{ color: verificacionActiva ? '#4ade80' : '#94a3b8' }} />
                  Verificación de Quórum
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {verificacionActiva
                    ? 'Activa — los votantes ven el popup de confirmación de asistencia'
                    : 'Inactiva — al activar aparece un popup en la página de votación'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  type="button"
                  onClick={toggleVerificacion}
                  disabled={toggling}
                  className={`rounded-3xl font-semibold flex items-center justify-center gap-2 py-2 px-5 text-sm ${
                    verificacionActiva
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {toggling ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  {verificacionActiva ? 'Desactivar verificación' : 'Activar verificación'}
                </Button>
                <Button
                  type="button"
                  onClick={abrirModalAsistencia}
                  className="rounded-3xl font-semibold flex items-center justify-center gap-2 py-2 px-5 text-sm bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Registrar asistencia
                </Button>
              </div>
            </div>

            {/* Widget de stats cuando está activa o hay verificados */}
            {statsVerificacion && (statsVerificacion.total_verificados > 0 || verificacionActiva) && (
              <div className="flex flex-wrap items-center gap-3 px-4 py-2 rounded-2xl border border-[rgba(255,255,255,0.07)]"
                style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Asistencia verificada:</span>
                <span className={`text-sm font-bold ${
                  statsVerificacion.quorum_alcanzado ? 'text-green-400' :
                  statsVerificacion.porcentaje_verificado >= 30 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {statsVerificacion.porcentaje_verificado.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">
                  ({statsVerificacion.total_verificados} unidades · coef. {statsVerificacion.coeficiente_verificado.toFixed(4)}%)
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  statsVerificacion.quorum_alcanzado
                    ? 'bg-green-900/40 text-green-300 border border-green-700/40'
                    : 'bg-red-900/40 text-red-300 border border-red-700/40'
                }`}>
                  {statsVerificacion.quorum_alcanzado ? '✓ Quórum alcanzado' : '✗ Sin quórum'} (Ley 675 &gt;50%)
                </span>
              </div>
            )}
          </div>

          {/* Link de votación: contenedor destacado parte superior central, fuente legible, Copiar Enlace con icono */}
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-3xl border border-[rgba(255,255,255,0.1)] px-4 py-4 mb-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
            <label className="sr-only">Enlace de votación</label>
            <input
              type="text"
              readOnly
              value={urlPublica}
              className="flex-1 min-w-0 px-4 py-3 text-base sm:text-lg bg-white/5 border border-[rgba(255,255,255,0.1)] rounded-3xl text-slate-200 truncate font-sans"
              style={{ color: '#e2e8f0' }}
              aria-label="URL de votación"
            />
            <Button
              onClick={copiarEnlace}
              className="shrink-0 rounded-3xl font-semibold bg-white text-slate-800 hover:bg-slate-100 border border-[rgba(255,255,255,0.1)] flex items-center justify-center gap-2 py-3 px-5"
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
            <Card className="rounded-3xl border border-[rgba(255,255,255,0.1)] overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
              <CardHeader className="bg-indigo-600 text-white py-4">
                <CardTitle className="text-lg flex items-center">
                  <QrCode className="w-5 h-5 mr-2" />
                  Código QR de Acceso
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex flex-col items-center">
                <div className="bg-white p-4 rounded-3xl shadow-inner border border-gray-100 mb-4" role="img" aria-label="Código QR de acceso a la votación">
                  {urlPublica && (
                    <QRCodeSVG value={urlPublica} size={180} level="H" includeMargin />
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                  Los asambleístas deben escanear este código para ingresar a la votación.
                </p>
                <p className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 py-2 px-4 rounded-3xl">
                  CÓDIGO: {asamblea?.codigo_acceso}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-[rgba(255,255,255,0.1)] overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
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
              <Card className="flex flex-col overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
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
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Buscar..."
                      aria-label="Buscar en sesión activa"
                      value={searchSesion}
                      onChange={(e) => setSearchSesion(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
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
              <Card className="flex flex-col overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-slate-200">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    Ya Votaron
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-1">
                    Tienen registro en votos
                  </p>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Buscar..."
                      aria-label="Buscar en ya votaron"
                      value={searchYaVotaron}
                      onChange={(e) => setSearchYaVotaron(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
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

              {/* Pendientes (Faltantes): todas las unidades que no han votado (con o sin sesión), para localizar y alcanzar quórum */}
              <Card className="flex flex-col overflow-hidden rounded-3xl border border-amber-500/50 border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0 bg-amber-50 dark:bg-amber-900/20">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                    <UserX className="w-4 h-4" />
                    Pendientes (Faltantes)
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Unidades que aún no han votado — para localizar y alcanzar quórum
                  </p>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Buscar..."
                      aria-label="Buscar en pendientes"
                      value={searchFaltantes}
                      onChange={(e) => setSearchFaltantes(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 overflow-y-auto overscroll-contain">
                    {faltantesFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 flex items-center gap-2 justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        {faltantes.length === 0 ? 'Todas las unidades ya votaron.' : 'Ninguna unidad coincide con la búsqueda.'}
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {faltantesFiltrados.map((u) => (
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

          {/* Gráfica: ancho completo en fila inferior */}
          {preguntasConResultados.length > 0 && (
            <div className="w-full lg:col-span-3 mt-6">
              <Card className="w-full rounded-3xl border border-[rgba(255,255,255,0.1)] overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.1)] py-4 px-6">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Vote className="w-5 h-5 text-emerald-500" />
                    Avance de votaciones
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Línea vertical = Mayoría necesaria (51%). Se actualiza cada 10 s.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGraficaMaximizada(true)}
                  className="shrink-0 rounded-3xl border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
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
                  const pctRelevante = (r: ResultadoOpcion) =>
                    preg.tipo_votacion === 'nominal' ? (r.porcentaje_nominal_total ?? 0) : r.porcentaje_coeficiente_total
                  const maxLabelLen = esMobile ? 14 : 22
                  const data: BarChartData[] = preg.resultados.map((r) => {
                    const pct = pctRelevante(r)
                    const texto = r.opcion_texto || ''
                    return {
                      name: texto.length > maxLabelLen + 2 ? texto.slice(0, maxLabelLen) + '…' : texto,
                      fullName: texto,
                      porcentaje: Math.round(pct * 100) / 100,
                      votosCantidad: Number(r.votos_cantidad) || 0,
                      color: r.color,
                      aprueba: preg.umbral_aprobacion != null && pct >= preg.umbral_aprobacion
                    }
                  })
                  const umbral = preg.umbral_aprobacion ?? 51
                  return (
                    <div key={preg.id} className="space-y-3 min-w-0">
                      <p className="text-base font-semibold text-slate-200 line-clamp-2">
                        {preg.texto_pregunta}
                      </p>
                      <div className="h-[320px] min-h-[240px] w-full overflow-x-auto overflow-y-hidden -mx-1 px-1">
                        <div className="h-full min-w-[260px] w-full">
                          <VotacionBarChart
                            data={data}
                            umbral={umbral}
                            tipoVotacion={preg.tipo_votacion ?? 'coeficiente'}
                            variant="panel"
                            esMobile={esMobile}
                          />
                        </div>
                      </div>
                      {data.some((d) => d.aprueba) && (
                        <div className="flex flex-wrap gap-2">
                          {data.filter((d) => d.aprueba).map((d, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-3 py-1.5 rounded-3xl text-sm font-bold text-emerald-200 bg-emerald-900/40 border border-emerald-600"
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
            </div>
          )}
        </div>
      </main>

      {/* Modal: gráfica de avance en grande (pop-up) */}
      <Dialog open={graficaMaximizada} onOpenChange={setGraficaMaximizada}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-y-auto p-8 rounded-3xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: '#0B0E14' }}>
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
              const pctRelevante = (r: ResultadoOpcion) =>
                preg.tipo_votacion === 'nominal' ? (r.porcentaje_nominal_total ?? 0) : r.porcentaje_coeficiente_total
              const data: BarChartData[] = preg.resultados.map((r) => {
                const pct = pctRelevante(r)
                return {
                  name: r.opcion_texto.length > 28 ? r.opcion_texto.slice(0, 26) + '…' : r.opcion_texto,
                  fullName: r.opcion_texto,
                  porcentaje: Math.round(pct * 100) / 100,
                  votosCantidad: Number(r.votos_cantidad) || 0,
                  color: r.color,
                  aprueba: preg.umbral_aprobacion != null && pct >= preg.umbral_aprobacion
                }
              })
              const umbral = preg.umbral_aprobacion ?? 51
              return (
                <div key={preg.id} className="space-y-4">
                  <p className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
                    {preg.texto_pregunta}
                  </p>
                  <div className="min-h-[50vh] h-[55vh] w-full">
                    <VotacionBarChart
                      data={data}
                      umbral={umbral}
                      tipoVotacion={preg.tipo_votacion ?? 'coeficiente'}
                      variant="proyector"
                    />
                  </div>
                  {data.some((d) => d.aprueba) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.filter((d) => d.aprueba).map((d, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-4 py-2 rounded-3xl text-base font-bold text-emerald-200 bg-emerald-900/40 border border-emerald-600"
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

      {/* Modal: Registro manual de asistencia */}
      <Dialog open={showModalAsistencia} onOpenChange={(v) => { if (!guardandoAsistencia) setShowModalAsistencia(v) }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 rounded-3xl border border-[rgba(255,255,255,0.15)] overflow-hidden" style={{ backgroundColor: '#0B0E14' }}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[rgba(255,255,255,0.08)] flex-shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2 text-lg text-slate-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Registrar asistencia manual
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowModalAsistencia(false)}
                className="absolute right-4 top-4"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Selecciona las unidades cuya asistencia quieres registrar. Las que ya verificaron aparecen marcadas y no se pueden volver a seleccionar.
            </p>
          </DialogHeader>

          {/* Buscador + seleccionar todas */}
          <div className="px-6 py-3 border-b border-[rgba(255,255,255,0.08)] flex-shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={busquedaAsistencia}
                onChange={(e) => setBusquedaAsistencia(e.target.value)}
                placeholder="Buscar por torre, número o propietario..."
                className="w-full pl-9 pr-4 py-2 rounded-2xl bg-white/5 border border-[rgba(255,255,255,0.1)] text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {!cargandoUnidadesAsistencia && unidadesParaAsistencia.length > 0 && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleSeleccionarTodas}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                >
                  {(() => {
                    const pendientes = unidadesParaAsistencia.filter((u) => {
                      if (u.ya_verifico) return false
                      if (!busquedaAsistencia.trim()) return true
                      const q = busquedaAsistencia.toLowerCase()
                      return `${u.torre} ${u.numero}`.toLowerCase().includes(q) || u.nombre_propietario.toLowerCase().includes(q)
                    })
                    return pendientes.length > 0 && pendientes.every((u) => seleccionadas.has(u.id))
                      ? 'Deseleccionar todas'
                      : 'Seleccionar todas'
                  })()}
                </button>
                <span className="text-xs text-slate-500">
                  {seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Lista de unidades */}
          <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
            {cargandoUnidadesAsistencia ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-transparent" />
                Cargando unidades...
              </div>
            ) : unidadesParaAsistencia.length === 0 ? (
              <p className="text-center py-12 text-slate-500 text-sm">No hay unidades registradas.</p>
            ) : (
              <div className="space-y-1">
                {unidadesParaAsistencia
                  .filter((u) => {
                    if (!busquedaAsistencia.trim()) return true
                    const q = busquedaAsistencia.toLowerCase()
                    return (
                      `${u.torre} ${u.numero}`.toLowerCase().includes(q) ||
                      u.nombre_propietario.toLowerCase().includes(q)
                    )
                  })
                  .map((u) => {
                    const checked = u.ya_verifico || seleccionadas.has(u.id)
                    const disabled = u.ya_verifico
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-colors ${
                          disabled
                            ? 'opacity-50 cursor-default'
                            : checked
                            ? 'bg-emerald-900/20 border border-emerald-700/30'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => !disabled && toggleUnidad(u.id)}
                          className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-200">
                            {u.torre !== 'S/T' ? `Torre ${u.torre} · ` : ''}Apto {u.numero}
                          </span>
                          <span className="text-xs text-slate-400 ml-2 truncate">{u.nombre_propietario}</span>
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">coef. {u.coeficiente.toFixed(4)}%</span>
                        {u.ya_verifico && (
                          <span className="text-xs text-emerald-400 font-semibold shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verificada
                          </span>
                        )}
                      </label>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Footer con botón guardar */}
          <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.08)] flex-shrink-0 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">
              {seleccionadas.size > 0
                ? `${seleccionadas.size} unidad${seleccionadas.size !== 1 ? 'es' : ''} seleccionada${seleccionadas.size !== 1 ? 's' : ''}`
                : 'Ninguna unidad seleccionada'}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowModalAsistencia(false)}
                disabled={guardandoAsistencia}
                className="rounded-2xl text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={guardarAsistenciaManual}
                disabled={seleccionadas.size === 0 || guardandoAsistencia}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2"
              >
                {guardandoAsistencia ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Guardar asistencia
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
