'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  X,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'
import type { BarChartData } from '@/components/charts/VotacionBarChart'
import { ModalRegistroAsistencia } from '@/components/ModalRegistroAsistencia'
import { buildPublicVotarUrl } from '@/lib/publicVotarUrl'

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
  verificacion_asistencia_activa?: boolean
  participacion_timer_end_at?: string | null
  participacion_timer_default_minutes?: number | null
  participacion_timer_enabled?: boolean | null
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
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
  es_poder?: boolean
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
  estado?: string
}

export default function AsambleaAccesoPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [asistentes, setAsistentes] = useState<Asistente[]>([])
  const [yaVotaron, setYaVotaron] = useState<UnidadFila[]>([])
  const [faltantes, setFaltantes] = useState<UnidadFila[]>([])
  /** Cuando verificacion_asistencia_activa: listas para paneles "Ya verificaron" / "Faltan por verificar" */
  const [verificadosAsistencia, setVerificadosAsistencia] = useState<UnidadFila[]>([])
  const [faltanVerificar, setFaltanVerificar] = useState<UnidadFila[]>([])
  const [searchVerificados, setSearchVerificados] = useState('')
  const [searchFaltanVerificar, setSearchFaltanVerificar] = useState('')
  const [openVerificacion, setOpenVerificacion] = useState(false)
  const [openEnlace, setOpenEnlace] = useState(true)
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
  const [showModalAvisoReabrirQuorum, setShowModalAvisoReabrirQuorum] = useState(false)
  const [noVolverMostrarAvisoQuorum, setNoVolverMostrarAvisoQuorum] = useState(false)
  const [mostrarCronometroConfig, setMostrarCronometroConfig] = useState(true)

  // Cronómetro de intervención (indicador, no cierra preguntas)
  const TIMER_DEFAULT_MINUTES_FALLBACK = 5
  const participationTimerEnabled = asamblea?.participacion_timer_enabled ?? true
  const timerDefaultSecondsValue =
    (Number(asamblea?.participacion_timer_default_minutes ?? TIMER_DEFAULT_MINUTES_FALLBACK) || TIMER_DEFAULT_MINUTES_FALLBACK) * 60
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(timerDefaultSecondsValue)
  const [timerStartDraftMinutes, setTimerStartDraftMinutes] = useState<number>(TIMER_DEFAULT_MINUTES_FALLBACK)
  const [timerStarting, setTimerStarting] = useState(false)
  interface VerificacionStats {
    total_verificados: number
    coeficiente_verificado: number
    porcentaje_verificado: number
    quorum_alcanzado: boolean
  }
  interface VerificacionDesglose {
    total_verificados: number
    porcentaje_total: number
    porcentaje_directo: number
    porcentaje_poder: number
    quorum_alcanzado: boolean
  }
  const [statsVerificacion, setStatsVerificacion] = useState<VerificacionStats | null>(null)
  const [statsDesglose, setStatsDesglose] = useState<VerificacionDesglose | null>(null)

  // Enlace delegado
  const [showModalAsistencia, setShowModalAsistencia] = useState(false)

  useEffect(() => {
    loadAsamblea()
    loadAsistentes()
    loadAvanceVotaciones()

    const interval = setInterval(() => {
      loadAsamblea()
      loadAsistentes(true)
      loadAvanceVotaciones()
    }, 5000)

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadAsamblea()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
        .select('id, nombre, codigo_acceso, estado, organization_id, is_demo, sandbox_usar_unidades_reales, verificacion_asistencia_activa, verificacion_pregunta_id, participacion_timer_end_at, participacion_timer_default_minutes, participacion_timer_enabled')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (error) throw error
      setAsamblea(data)
      setVerificacionActiva(!!(data as any).verificacion_asistencia_activa)
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData.user?.id ?? null
      if (currentUserId && data.organization_id) {
        const { data: cfg } = await supabase
          .from('configuracion_asamblea')
          .select('mostrar_cronometro')
          .eq('user_id', currentUserId)
          .eq('organization_id', data.organization_id)
          .maybeSingle()
        setMostrarCronometroConfig(cfg?.mostrar_cronometro !== false)
      } else {
        setMostrarCronometroConfig(true)
      }
      setUrlPublica(buildPublicVotarUrl(data.codigo_acceso))
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

  // ── Cronómetro de intervención (indicador en UI) ──────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    const tick = () => {
      const endIso = asamblea?.participacion_timer_end_at ?? null
      const defaultMinutes = Number(asamblea?.participacion_timer_default_minutes ?? TIMER_DEFAULT_MINUTES_FALLBACK) || TIMER_DEFAULT_MINUTES_FALLBACK
      const defaultSeconds = defaultMinutes * 60

      if (!participationTimerEnabled) {
        // Cronómetro deshabilitado: no debe contar.
        setTimerSecondsLeft(defaultSeconds)
        return
      }

      if (!endIso) {
        setTimerSecondsLeft(defaultSeconds)
        return
      }

      const endMs = Date.parse(endIso)
      if (!Number.isFinite(endMs) || endMs <= Date.now()) {
        setTimerSecondsLeft(defaultSeconds)
        return
      }

      const remaining = Math.floor((endMs - Date.now()) / 1000)
      if (!Number.isFinite(remaining) || remaining <= 0) {
        setTimerSecondsLeft(defaultSeconds)
        return
      }
      setTimerSecondsLeft(remaining)
    }

    tick()

    const endIso = asamblea?.participacion_timer_end_at ?? null
    const endMs = endIso ? Date.parse(endIso) : null
    if (participationTimerEnabled && endMs && Number.isFinite(endMs) && endMs > Date.now()) {
      const intervalId = window.setInterval(tick, 1000)
      return () => window.clearInterval(intervalId)
    }
    return
  }, [participationTimerEnabled, asamblea?.participacion_timer_end_at, asamblea?.participacion_timer_default_minutes])

  useEffect(() => {
    const dm = Number(asamblea?.participacion_timer_default_minutes ?? TIMER_DEFAULT_MINUTES_FALLBACK) || TIMER_DEFAULT_MINUTES_FALLBACK
    setTimerStartDraftMinutes(dm)
  }, [asamblea?.participacion_timer_default_minutes])

  const iniciarCronometroAdmin = async () => {
    if (!asamblea) return
    const minutes = Math.floor(Number(timerStartDraftMinutes))
    if (!Number.isFinite(minutes) || minutes < 1) return

    setTimerStarting(true)
    try {
      const res = await fetch('/api/dashboard/participacion-timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: params.id, minutes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error al iniciar cronómetro')

      // Actualización inmediata: el polling de `loadAsamblea` refresca en segundos.
      if (data.participacion_timer_end_at) {
        setAsamblea((prev) => (prev ? { ...prev, participacion_timer_end_at: data.participacion_timer_end_at } : prev))
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error al iniciar cronómetro')
    } finally {
      setTimerStarting(false)
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
      // Refrescar asamblea para no depender del closure (interval/refrescar usan datos actuales)
      const { data: asambleaFresh } = await supabase
        .from('asambleas')
        .select('organization_id, verificacion_asistencia_activa, verificacion_pregunta_id, is_demo, sandbox_usar_unidades_reales')
        .eq('id', params.id)
        .single()

      const orgId = asambleaFresh?.organization_id ?? asamblea?.organization_id
      if (!orgId) return

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

      // En Acceso solo se muestran preguntas ABIERTAS en la gráfica (las cerradas no se votan ni se ven aquí)
      const { data: preguntasData } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, umbral_aprobacion, tipo_votacion, estado')
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
          resultados,
          estado: (p as { estado?: string }).estado
        })
      }
      setPreguntasAvance(avances)
      setPreguntasConResultados(conResultados)

      // Tarjeta "Asistencia verificada": solo GENERAL (pregunta_id null).
      const verifActiva = !!asambleaFresh?.verificacion_asistencia_activa
      if (verifActiva) {
        const { data: verData } = await supabase.rpc('calcular_verificacion_quorum', {
          p_asamblea_id: params.id,
          p_pregunta_id: null,
          p_solo_sesion_actual: true,
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
          const { data: sesionesData } = await supabase
            .from('verificacion_asamblea_sesiones')
            .select('total_verificados, coeficiente_verificado, porcentaje_verificado, quorum_alcanzado')
            .eq('asamblea_id', params.id)
            .is('pregunta_id', null)
            .not('cierre_at', 'is', null)
            .order('cierre_at', { ascending: false })
            .limit(1)
          if (sesionesData?.length) {
            const s = sesionesData[0] as VerificacionStats
            setStatsVerificacion({
              total_verificados: Number(s.total_verificados) ?? 0,
              coeficiente_verificado: Number(s.coeficiente_verificado) ?? 0,
              porcentaje_verificado: Number(s.porcentaje_verificado) ?? 0,
              quorum_alcanzado: !!s.quorum_alcanzado,
            })
          } else {
            setStatsVerificacion({ total_verificados: 0, coeficiente_verificado: 0, porcentaje_verificado: 0, quorum_alcanzado: false })
          }
        }
      } else {
        const { data: sesionesData } = await supabase
          .from('verificacion_asamblea_sesiones')
          .select('total_verificados, coeficiente_verificado, porcentaje_verificado, quorum_alcanzado')
          .eq('asamblea_id', params.id)
          .is('pregunta_id', null)
          .not('cierre_at', 'is', null)
          .order('cierre_at', { ascending: false })
          .limit(1)
        if (sesionesData?.length) {
          const s = sesionesData[0] as VerificacionStats
          setStatsVerificacion({
            total_verificados: Number(s.total_verificados) ?? 0,
            coeficiente_verificado: Number(s.coeficiente_verificado) ?? 0,
            porcentaje_verificado: Number(s.porcentaje_verificado) ?? 0,
            quorum_alcanzado: !!s.quorum_alcanzado,
          })
        } else {
          setStatsVerificacion({ total_verificados: 0, coeficiente_verificado: 0, porcentaje_verificado: 0, quorum_alcanzado: false })
        }
      }

      try {
        // Desglose para el panel "Ya verificaron": siempre sesión general
        const preguntaIdDesglose = null
        const { data: desgloseData } = await supabase.rpc('calcular_verificacion_quorum_desglose', {
          p_asamblea_id: params.id,
          p_pregunta_id: preguntaIdDesglose,
          p_solo_sesion_actual: verifActiva,
        })
        if (desgloseData?.length && desgloseData[0]) {
          const d = desgloseData[0] as {
            total_verificados?: number
            porcentaje_total?: number
            porcentaje_directo?: number
            porcentaje_poder?: number
            quorum_alcanzado?: boolean
          }
          setStatsDesglose({
            total_verificados: Number(d.total_verificados) || 0,
            porcentaje_total: Number(d.porcentaje_total) ?? 0,
            porcentaje_directo: Number(d.porcentaje_directo) ?? 0,
            porcentaje_poder: Number(d.porcentaje_poder) ?? 0,
            quorum_alcanzado: !!d.quorum_alcanzado,
          })
        } else {
          setStatsDesglose(null)
        }
      } catch {
        setStatsDesglose(null)
      }

      const { data: votosData } = await supabase
        .from('votos')
        .select('unidad_id, es_poder')
        .in('pregunta_id', (preguntasData || []).map((x) => x.id))

      const unidadIdsVotaron = Array.from(new Set((votosData || []).map((v: any) => v.unidad_id).filter(Boolean)))
      const esPoderPorUnidadVoto = new Map<string, boolean>()
      ;(votosData || []).forEach((v: any) => {
        if (v.unidad_id && v.es_poder === true) esPoderPorUnidadVoto.set(v.unidad_id, true)
      })

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
          coeficiente: Number(u.coeficiente) || 0,
          es_poder: esPoderPorUnidadVoto.get(u.id) ?? false,
        })))
      } else setYaVotaron([])

      const soloUnidadesDemo = asambleaFresh?.is_demo === true && !(asambleaFresh?.sandbox_usar_unidades_reales === true)
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

      // Si la verificación de quórum está activa, cargar paneles "Ya verificaron" / "Faltan por verificar" (solo sesión actual, con es_poder)
      if (asambleaFresh?.verificacion_asistencia_activa && orgId) {
        const preguntaId = (asambleaFresh as { verificacion_pregunta_id?: string | null }).verificacion_pregunta_id ?? null
        const esPoderVerificados = new Map<string, boolean>()
        const { data: idsSesion, error: rpcError } = await supabase.rpc('unidad_ids_verificados_sesion_actual', {
          p_asamblea_id: params.id,
          p_pregunta_id: preguntaId,
        })
        const idsVerificados = new Set<string>()
        if (!rpcError && idsSesion?.length !== undefined) {
          (idsSesion as { unidad_id: string; es_poder?: boolean }[]).forEach((r) => {
            if (r.unidad_id) {
              idsVerificados.add(r.unidad_id)
              if (r.es_poder === true) esPoderVerificados.set(r.unidad_id, true)
            }
          })
        }
        const soloDemo = asambleaFresh?.is_demo === true && !(asambleaFresh?.sandbox_usar_unidades_reales === true)
        let qUnidades = supabase
          .from('unidades')
          .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
          .eq('organization_id', orgId)
        qUnidades = soloDemo ? qUnidades.eq('is_demo', true) : qUnidades.or('is_demo.eq.false,is_demo.is.null')
        const { data: todasUnidadesVerif } = await qUnidades
        const lista = (todasUnidadesVerif || []).map((u: any) => ({
          id: u.id,
          torre: u.torre || 'S/T',
          numero: u.numero || 'S/N',
          nombre_propietario: u.nombre_propietario || 'S/N',
          email_propietario: u.email_propietario || '',
          coeficiente: Number(u.coeficiente) || 0,
          es_poder: esPoderVerificados.get(u.id) ?? false,
        }))
        const verificados = lista.filter((u) => idsVerificados.has(u.id))
        const faltan = lista.filter((u) => !idsVerificados.has(u.id))
        setVerificadosAsistencia(verificados)
        setFaltanVerificar(faltan)
      } else {
        setVerificadosAsistencia([])
        setFaltanVerificar([])
        setStatsDesglose(null)
      }
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

  const AVISO_REABRIR_QUORUM_OMITIR_KEY = 'asambleas_quorum_reabrir_aviso_omitir'

  const toggleVerificacion = async () => {
    if (toggling) return
    setToggling(true)
    try {
      const nuevoValor = !verificacionActiva
      /** Solo verificación general (asamblea), no por pregunta. */
      const payload: { verificacion_asistencia_activa: boolean; verificacion_pregunta_id: string | null } = {
        verificacion_asistencia_activa: nuevoValor,
        verificacion_pregunta_id: null,
      }

      const { data: updatedRow, error } = await supabase
        .from('asambleas')
        .update(payload)
        .eq('id', params.id)
        .select('verificacion_asistencia_activa, verificacion_pregunta_id')
        .single()
      if (error) {
        toast.error('No se pudo actualizar la verificación: ' + (error.message || 'Error en la base de datos'))
        return
      }
      setVerificacionActiva(updatedRow ? !!updatedRow.verificacion_asistencia_activa : nuevoValor)
      if (nuevoValor) {
        const { data: verData } = await supabase.rpc('calcular_verificacion_quorum', {
          p_asamblea_id: params.id,
          p_pregunta_id: null,
          p_solo_sesion_actual: true,
        })
        if (verData?.length) {
          const v = verData[0]
          setStatsVerificacion({
            total_verificados: Number(v.total_verificados) || 0,
            coeficiente_verificado: Number(v.coeficiente_verificado) || 0,
            porcentaje_verificado: Number(v.porcentaje_verificado) || 0,
            quorum_alcanzado: !!v.quorum_alcanzado,
          })
        } else {
          setStatsVerificacion({ total_verificados: 0, coeficiente_verificado: 0, porcentaje_verificado: 0, quorum_alcanzado: false })
        }
      } else {
        const { data: sesionesData } = await supabase
          .from('verificacion_asamblea_sesiones')
          .select('total_verificados, coeficiente_verificado, porcentaje_verificado, quorum_alcanzado')
          .eq('asamblea_id', params.id)
          .is('pregunta_id', null)
          .not('cierre_at', 'is', null)
          .order('cierre_at', { ascending: false })
          .limit(1)
        if (sesionesData?.length) {
          const s = sesionesData[0] as VerificacionStats
          setStatsVerificacion({
            total_verificados: Number(s.total_verificados) ?? 0,
            coeficiente_verificado: Number(s.coeficiente_verificado) ?? 0,
            porcentaje_verificado: Number(s.porcentaje_verificado) ?? 0,
            quorum_alcanzado: !!s.quorum_alcanzado,
          })
        } else {
          setStatsVerificacion({ total_verificados: 0, coeficiente_verificado: 0, porcentaje_verificado: 0, quorum_alcanzado: false })
        }
      }
      if (!nuevoValor) {
        await loadAvanceVotaciones()
      }
    } finally {
      setToggling(false)
    }
  }

  const onActivarVerificacionClick = () => {
    if (verificacionActiva) {
      toggleVerificacion()
      return
    }
    if (typeof window !== 'undefined' && window.localStorage.getItem(AVISO_REABRIR_QUORUM_OMITIR_KEY) === '1') {
      toggleVerificacion()
      return
    }
    setNoVolverMostrarAvisoQuorum(false)
    setShowModalAvisoReabrirQuorum(true)
  }

  const confirmarAvisoReabrirQuorum = () => {
    if (noVolverMostrarAvisoQuorum && typeof window !== 'undefined') {
      window.localStorage.setItem(AVISO_REABRIR_QUORUM_OMITIR_KEY, '1')
    }
    setShowModalAvisoReabrirQuorum(false)
    toggleVerificacion()
  }

  // Si se entró con ?registrar=asistencia (enlace directo), abrir el modal y limpiar la URL
  useEffect(() => {
    if (!asamblea?.organization_id || searchParams.get('registrar') !== 'asistencia') return
    setShowModalAsistencia(true)
    router.replace(`/dashboard/asambleas/${params.id}/acceso`, { scroll: false })
  }, [asamblea?.organization_id, searchParams, params.id, router])

  const filtro = (texto: string, query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return texto.toLowerCase().includes(q)
  }

  /** Búsqueda tipo poderes: torre+apto (ej. "10 301", "10-301", "10301"), propietario o email */
  const matchUnidadAsistencia = (
    u: { torre?: string; numero?: string; nombre_propietario?: string; email_propietario?: string },
    search: string
  ) => {
    if (!search.trim()) return true
    const q = search.toLowerCase().replace(/[\s\-]/g, '')
    const torre = String(u.torre ?? '').toLowerCase()
    const numero = String(u.numero ?? '').toLowerCase()
    const torreNumero = torre + numero
    const nom = String(u.nombre_propietario ?? '').toLowerCase()
    const em = String(u.email_propietario ?? '').toLowerCase()
    return (
      numero.includes(q) ||
      torre.includes(q) ||
      torreNumero.includes(q) ||
      nom.includes(search.toLowerCase()) ||
      em.includes(search.toLowerCase())
    )
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

  const verificadosFiltrados = useMemo(() => {
    if (!searchVerificados.trim()) return verificadosAsistencia
    return verificadosAsistencia.filter((u) => matchUnidadAsistencia(u, searchVerificados))
  }, [verificadosAsistencia, searchVerificados])

  const faltanVerificarFiltrados = useMemo(() => {
    if (!searchFaltanVerificar.trim()) return faltanVerificar
    return faltanVerificar.filter((u) => matchUnidadAsistencia(u, searchFaltanVerificar))
  }, [faltanVerificar, searchFaltanVerificar])

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
              onClick={async () => {
                setRecargando(true)
                try {
                  await loadAvanceVotaciones()
                  await loadAsistentes(true)
                } finally {
                  setRecargando(false)
                }
              }}
              disabled={recargando}
              className="rounded-3xl border-gray-200 dark:border-[rgba(255,255,255,0.1)]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${recargando ? 'animate-spin' : ''}`} />
              {recargando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>

          {saldoInsuficiente && (
            <div className="mb-4 rounded-3xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 font-semibold">Saldo insuficiente para procesar esta asamblea.</span>
              <span className="text-slate-300 text-sm">Billetera: {tokensDisponibles} tokens (créditos) · Se requieren {totalUnidadesConjunto} para esta operación.</span>
            </div>
          )}

          {/* 1. Enlace de votación — collapsable (abierto por defecto) */}
          <div className="w-full mb-3 rounded-3xl border border-[rgba(255,255,255,0.1)] overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
            <button type="button" onClick={() => setOpenEnlace((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="text-sm font-semibold text-slate-200">Enlace de votación</span>
                <span className="text-xs text-slate-500 truncate max-w-[12rem] sm:max-w-xs" title={urlPublica}>{urlPublica.replace(/^https?:\/\//, '').split('/')[0]}/…</span>
              </div>
              {openEnlace ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
            {openEnlace && (
              <div className="px-4 pb-4 pt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-white/10">
                <label className="sr-only">Enlace de votación</label>
                <input type="text" readOnly value={urlPublica} className="flex-1 min-w-0 px-4 py-3 text-base bg-white/5 border border-[rgba(255,255,255,0.1)] rounded-2xl text-slate-200 truncate font-sans" style={{ color: '#e2e8f0' }} aria-label="URL de votación" />
                <Button onClick={copiarEnlace} className="shrink-0 rounded-2xl font-semibold bg-white text-slate-800 hover:bg-slate-100 border border-[rgba(255,255,255,0.1)] flex items-center justify-center gap-2 py-2.5 px-4" title="Copiar enlace al portapapeles">
                  <Copy className="w-4 h-4" /> {copiado ? '¡Copiado!' : 'Copiar Enlace'}
                </Button>
              </div>
            )}
          </div>

          {/* 2. Verificación de Quórum — collapsable */}
          <div className="w-full mb-3 rounded-3xl border overflow-hidden" style={{ backgroundColor: verificacionActiva ? 'rgba(21,128,61,0.12)' : 'rgba(15,23,42,0.6)', borderColor: verificacionActiva ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)' }}>
            <button
              type="button"
              onClick={() => setOpenVerificacion((v) => !v)}
              className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 shrink-0" style={{ color: verificacionActiva ? '#4ade80' : '#94a3b8' }} />
                <span className="text-sm font-semibold text-slate-200">Verificación de Quórum</span>
                {statsVerificacion && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statsVerificacion.quorum_alcanzado ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                    {statsVerificacion.porcentaje_verificado.toFixed(1)}% · {statsVerificacion.quorum_alcanzado ? 'Quórum' : 'Sin quórum'}
                  </span>
                )}
              </div>
              {openVerificacion ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
            {openVerificacion && (
              <div className="px-4 pb-4 pt-0 space-y-2 border-t border-white/10">
                <p className="text-xs text-slate-400 pt-2">
                  {verificacionActiva
                    ? 'Activa — Los votantes ven el popup para confirmar asistencia (sesión general de la asamblea). Al desactivar, el resultado queda en el acta.'
                    : 'Inactiva — Al activar, los votantes verán el popup en la página de votación. Cada vez que activas se inicia una nueva sesión (quórum a cero).'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={onActivarVerificacionClick} disabled={toggling}
                    className={`rounded-2xl font-semibold text-sm py-2 px-4 ${verificacionActiva ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}>
                    {toggling ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent inline-block" /> : <UserCheck className="w-4 h-4" />}
                    <span className="ml-1.5">{verificacionActiva ? 'Desactivar' : 'Activar'}</span>
                  </Button>
                  <Button type="button" onClick={() => setShowModalAsistencia(true)} className="rounded-2xl font-semibold text-sm py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Registrar asistencia
                  </Button>
                </div>
                {statsVerificacion && (
                  <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                    <span className="text-slate-400">Asistencia (general):</span>
                    <span className={`font-bold ${statsVerificacion.quorum_alcanzado ? 'text-green-400' : statsVerificacion.porcentaje_verificado >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                      {statsVerificacion.porcentaje_verificado.toFixed(1)}%
                    </span>
                    <span className="text-slate-400">({statsVerificacion.total_verificados} un. · coef. {statsVerificacion.coeficiente_verificado.toFixed(4)}%)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cronómetro de intervención (indicador global) */}
          {mostrarCronometroConfig && participationTimerEnabled && (
            <div
            className="w-full mb-3 rounded-3xl border border-[rgba(255,255,255,0.1)] overflow-hidden"
            style={{
              backgroundColor:
                asamblea?.participacion_timer_end_at && Date.parse(asamblea.participacion_timer_end_at) > Date.now()
                  ? 'rgba(79,70,229,0.12)'
                  : 'rgba(15,23,42,0.6)',
            }}
          >
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="w-5 h-5 text-indigo-300" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200">Cronómetro de intervención</p>
                  <p className="text-xs text-slate-400">
                    {asamblea?.participacion_timer_end_at && Date.parse(asamblea.participacion_timer_end_at) > Date.now()
                      ? 'Activo (cuenta regresivo)'
                      : 'Inactivo (muestra default, sin contar)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-mono text-xl sm:text-2xl font-bold text-indigo-200 tabular-nums">
                  {formatMMSS(timerSecondsLeft)}
                </p>
              </div>
            </div>

            <div className="px-4 pb-4 space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 max-w-md">
                <label className="text-xs text-slate-300 block mb-2">Iniciar (esta vez)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={timerStartDraftMinutes}
                    onChange={(e) => setTimerStartDraftMinutes(Number(e.target.value))}
                    className="w-20 rounded-xl border border-white/20 bg-slate-900/30 text-slate-200 px-2 py-2"
                  />
                  <Button
                    type="button"
                    onClick={iniciarCronometroAdmin}
                    disabled={timerStarting}
                    className="rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold"
                  >
                    {timerStarting ? 'Iniciando…' : 'Activar'}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                No cierra preguntas ni afecta la votación. Solo sincroniza un indicador de tiempo para intervenciones.
              </p>
            </div>
            </div>
          )}

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

          {/* Paneles: con verificación de quórum activa → 2 paneles (Ya verificaron | Faltan por verificar); si no → 3 paneles (Sesión Activa | Ya Votaron | Pendientes) */}
          <div className="lg:col-span-2">
            {verificacionActiva ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-12rem)] min-h-[480px]">
                {/* Ya verificaron asistencia */}
                <Card className="flex flex-col overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                  <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0 bg-emerald-50 dark:bg-emerald-900/20">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      Ya verificaron asistencia
                      <span className="font-bold tabular-nums">({verificadosAsistencia.length})</span>
                    </CardTitle>
                    {statsDesglose && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 font-medium">
                        Quórum {statsDesglose.porcentaje_total.toFixed(1)}%
                        {statsDesglose.porcentaje_directo > 0 && ` · ${statsDesglose.porcentaje_directo.toFixed(1)}% directos`}
                        {statsDesglose.porcentaje_poder > 0 && ` · ${statsDesglose.porcentaje_poder.toFixed(1)}% por poder`}
                        {statsDesglose.quorum_alcanzado && ' · ✓ Ley 675'}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Unidades que confirmaron asistencia en el popup
                    </p>
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                      <input
                        type="search"
                        placeholder="Buscar..."
                        aria-label="Buscar en ya verificaron"
                        value={searchVerificados}
                        onChange={(e) => setSearchVerificados(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                      {verificadosFiltrados.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">Nadie ha verificado asistencia aún.</div>
                      ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                          {verificadosFiltrados.map((u) => (
                            <li key={u.id} className="px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <div className="font-medium text-gray-900 dark:text-white">{u.es_poder ? 'Poder · ' : ''}{u.torre} - {u.numero}</div>
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

                {/* Faltan por verificar */}
                <Card className="flex flex-col overflow-hidden rounded-3xl border border-amber-500/50 border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                  <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0 bg-amber-50 dark:bg-amber-900/20">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                      <UserX className="w-4 h-4" />
                      Faltan por verificar
                      <span className="font-bold tabular-nums">({faltanVerificar.length})</span>
                    </CardTitle>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Unidades que aún no han confirmado asistencia — para alcanzar quórum
                    </p>
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                      <input
                        type="search"
                        placeholder="Buscar..."
                        aria-label="Buscar en faltan por verificar"
                        value={searchFaltanVerificar}
                        onChange={(e) => setSearchFaltanVerificar(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                      {faltanVerificarFiltrados.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500 flex items-center gap-2 justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          {faltanVerificar.length === 0 ? 'Todas las unidades ya verificaron.' : 'Ninguna unidad coincide con la búsqueda.'}
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                          {faltanVerificarFiltrados.map((u) => (
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-12rem)] min-h-[480px]">
                {/* Sesión Activa: unidades con ping de quórum activo */}
                <Card className="flex flex-col overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                  <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0 bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-green-600" />
                        Sesión Activa
                        <span className="font-bold tabular-nums">({asistentes.length})</span>
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

                {/* Ya Votaron */}
                <Card className="flex flex-col overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                  <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-slate-200">
                      <UserCheck className="w-4 h-4 text-emerald-500" />
                      Ya Votaron
                      <span className="font-bold tabular-nums">({yaVotaron.length})</span>
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
                              <div className="font-medium text-gray-900 dark:text-white">{u.es_poder ? 'Poder · ' : ''}{u.torre} - {u.numero}</div>
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

                {/* Pendientes (Faltantes) */}
                <Card className="flex flex-col overflow-hidden rounded-3xl border border-amber-500/50 border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
                  <CardHeader className="py-3 px-4 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0 bg-amber-50 dark:bg-amber-900/20">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                      <UserX className="w-4 h-4" />
                      Pendientes (Faltantes)
                      <span className="font-bold tabular-nums">({faltantes.length})</span>
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
            )}
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
                {statsVerificacion != null && (
                  <div className="flex flex-col gap-0.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Verificación de asistencia</span>
                      <span className={`font-bold ${statsVerificacion.quorum_alcanzado ? 'text-green-400' : 'text-amber-400'}`}>
                        {statsVerificacion.porcentaje_verificado.toFixed(1)}% ({statsVerificacion.total_verificados} un.)
                      </span>
                    </div>
                    {statsDesglose && (statsDesglose.porcentaje_directo > 0 || statsDesglose.porcentaje_poder > 0) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {statsDesglose.porcentaje_directo.toFixed(1)}% directos · {statsDesglose.porcentaje_poder.toFixed(1)}% por poder
                      </p>
                    )}
                  </div>
                )}
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
      {/* Modal: Aviso al reabrir quórum (activar verificación) */}
      <Dialog open={showModalAvisoReabrirQuorum} onOpenChange={setShowModalAvisoReabrirQuorum}>
        <DialogContent className="max-w-lg rounded-3xl border border-[rgba(255,255,255,0.15)]" style={{ backgroundColor: '#0B0E14' }} showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-300">
              <UserCheck className="w-5 h-5" />
              Al reabrir la verificación de asistencia
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Comienza una nueva sesión: el quórum vuelve a cero y las personas deberán validar su asistencia de nuevo.
            </DialogDescription>
            <div className="space-y-2 text-left text-sm text-slate-400 mt-2">
              <p>
                Al cerrar la verificación, el resultado quedará registrado en el acta como asistencia general de la asamblea (no se asocia a preguntas concretas).
              </p>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400 mt-3">
                <input
                  type="checkbox"
                  checked={noVolverMostrarAvisoQuorum}
                  onChange={(e) => setNoVolverMostrarAvisoQuorum(e.target.checked)}
                  className="rounded border-slate-500 bg-slate-800"
                />
                No volver a mostrar este mensaje
              </label>
            </div>
          </DialogHeader>
          <div className="mt-4 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setShowModalAvisoReabrirQuorum(false)} className="w-full sm:flex-1 border-slate-600 text-slate-300">
              Cancelar
            </Button>
            <Button onClick={confirmarAvisoReabrirQuorum} className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              Entendido, activar verificación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={graficaMaximizada} onOpenChange={setGraficaMaximizada}>
        <DialogContent showCloseButton={false} className="max-w-6xl w-[95vw] max-h-[95vh] overflow-y-auto p-8 rounded-3xl border border-[rgba(255,255,255,0.1)]" style={{ backgroundColor: '#0B0E14' }}>
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
            {statsVerificacion != null && (
              <div className="flex flex-col gap-1 text-base">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Verificación de asistencia</span>
                  <span className={`font-bold text-lg ${statsVerificacion.quorum_alcanzado ? 'text-green-400' : 'text-amber-400'}`}>
                    {statsVerificacion.porcentaje_verificado.toFixed(1)}% ({statsVerificacion.total_verificados} un.)
                  </span>
                </div>
                {statsDesglose && (statsDesglose.porcentaje_directo > 0 || statsDesglose.porcentaje_poder > 0) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {statsDesglose.porcentaje_directo.toFixed(1)}% directos · {statsDesglose.porcentaje_poder.toFixed(1)}% por poder
                  </p>
                )}
              </div>
            )}
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

      <ModalRegistroAsistencia
        open={showModalAsistencia}
        onOpenChange={setShowModalAsistencia}
        asambleaId={params.id}
        onGuardado={loadAvanceVotaciones}
      />
    </div>
  )
}
