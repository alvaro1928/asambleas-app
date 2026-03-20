'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, UserCheck, Vote, Search, RefreshCw, AlertTriangle, Users, HelpCircle, Settings2, ExternalLink, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { BarChartData } from '@/components/charts/VotacionBarChart'

const VotacionBarChart = dynamic(
  () => import('@/components/charts/VotacionBarChart'),
  { ssr: false, loading: () => <div className="w-full h-[200px] bg-gray-100 dark:bg-gray-700/50 animate-pulse rounded-2xl" /> }
)

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AsambleaInfo {
  asamblea_id: string
  nombre: string
  fecha: string
  estado: string
  organization_id: string
  nombre_conjunto: string
  is_demo: boolean
  sandbox_usar_unidades_reales: boolean
  participacion_timer_end_at?: string | null
  participacion_timer_default_minutes?: number
  participacion_timer_enabled?: boolean
  verificacion_pregunta_id?: string | null
  verificacion_asistencia_activa?: boolean
}

interface Unidad {
  id: string
  torre: string
  numero: string
  nombre_propietario: string
  email_propietario: string
  coeficiente: number
  ya_verifico: boolean
  es_poder?: boolean
}

interface Opcion {
  id: string
  texto_opcion: string
  color: string
  orden: number
}

interface Pregunta {
  id: string
  texto_pregunta: string
  estado: string
  tipo_votacion: string
  umbral_aprobacion?: number | null
  opciones: Opcion[]
}

interface VotoRegistrado {
  unidad_id: string
  pregunta_id: string
  es_poder?: boolean
}

interface ResultadoOpcionGrafica {
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
  tipo_votacion: string
  umbral_aprobacion: number | null
  resultados: ResultadoOpcionGrafica[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(fecha: string) {
  try {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return fecha }
}

// Cronómetro visual de participación (solo UI)
const DEFAULT_TIEMPO_PARTICIPACION_SECONDS = 5 * 60

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AsistirPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const codigo = (params?.codigo as string || '').toUpperCase()
  const token = searchParams?.get('t') || ''

  const [step, setStep] = useState<'validando' | 'ok' | 'error'>('validando')
  const [asamblea, setAsamblea] = useState<AsambleaInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [tab, setTab] = useState<'asistencia' | 'votacion'>('asistencia')

  // Cronómetro visual de participación (sin afectar votación).
  // Fuente de verdad: DB (participacion_timer_end_at y participacion_timer_default_minutes).
  const [participationTimerEndAt, setParticipationTimerEndAt] = useState<string | null>(null)
  const [participationTimerDefaultMinutes, setParticipationTimerDefaultMinutes] = useState<number>(DEFAULT_TIEMPO_PARTICIPACION_SECONDS / 60)
  const participationTimerDefaultSeconds = participationTimerDefaultMinutes * 60
  const [participationTimerSecondsLeft, setParticipationTimerSecondsLeft] = useState<number>(participationTimerDefaultSeconds)
  const [participationTimerEnded, setParticipationTimerEnded] = useState(false)

  // Si está deshabilitado en DB, el timer debe desaparecer totalmente.
  const [participationTimerEnabled, setParticipationTimerEnabled] = useState<boolean>(true)

  // Controles de cronómetro (default + start) — solo para delegado.
  const [timerDefaultDraftMinutes, setTimerDefaultDraftMinutes] = useState<number>(5)
  const [timerStartDraftMinutes, setTimerStartDraftMinutes] = useState<number>(5)
  const [timerSavingDefault, setTimerSavingDefault] = useState(false)
  const [timerStarting, setTimerStarting] = useState(false)

  // Asistencia
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [selAsistencia, setSelAsistencia] = useState<Set<string>>(new Set())
  const [busqAsistencia, setBusqAsistencia] = useState('')
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false)
  const [quitandoAsistenciaId, setQuitandoAsistenciaId] = useState<string | null>(null)
  const [msgAsistencia, setMsgAsistencia] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cargandoUnidades, setCargandoUnidades] = useState(false)

  // Votación
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [preguntaActiva, setPreguntaActiva] = useState<string>('')
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<string>('')
  const [selVotacion, setSelVotacion] = useState<Set<string>>(new Set())
  const [busqVotacion, setBusqVotacion] = useState('')
  const [votosRegistrados, setVotosRegistrados] = useState<VotoRegistrado[]>([])
  const [guardandoVoto, setGuardandoVoto] = useState(false)
  const [msgVotacion, setMsgVotacion] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cargandoPreguntas, setCargandoPreguntas] = useState(false)
  const [avanceVotaciones, setAvanceVotaciones] = useState<PreguntaConResultados[]>([])
  const [showAyudaDelegado, setShowAyudaDelegado] = useState(false)

  const [revalidando, setRevalidando] = useState(false)
  const isBackgroundRefreshRef = useRef(false)

  // Revalidar estado de la asamblea (verificación activa, pregunta_id) para actualizar pestañas sin recargar
  const revalidar = useCallback(async () => {
    if (!codigo || !token) return
    try {
      setRevalidando(true)
      const r = await fetch('/api/delegado/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_asamblea: codigo, token }),
        cache: 'no-store',
      })
      const data = await r.json()
      if (data.ok) {
        // Copia nueva para forzar re-render y que las pestañas se actualicen
        const { ok: _o, ...resto } = data
        setAsamblea(resto as AsambleaInfo)
        setParticipationTimerEnabled((resto as { participacion_timer_enabled?: boolean | null }).participacion_timer_enabled ?? true)
        if ('participacion_timer_end_at' in resto) {
          setParticipationTimerEndAt(((resto as any).participacion_timer_end_at as string | null) ?? null)
        }
        if ('participacion_timer_default_minutes' in resto) {
          setParticipationTimerDefaultMinutes(Number((resto as any).participacion_timer_default_minutes ?? 5) || 5)
        }
      }
    } catch {
      // No cambiar step para no expulsar al delegado; solo no actualizar
    } finally {
      setRevalidando(false)
    }
  }, [codigo, token])

  // ── Validar token al montar ──────────────────────────────────────────────
  useEffect(() => {
    if (!codigo || !token) {
      setErrorMsg('Enlace incompleto. Verifica que el enlace sea correcto.')
      setStep('error')
      return
    }
    fetch('/api/delegado/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_asamblea: codigo, token }),
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const { ok: _o, ...resto } = data
          setAsamblea(resto as AsambleaInfo)
          setParticipationTimerEnabled((resto as { participacion_timer_enabled?: boolean | null }).participacion_timer_enabled ?? true)
          if ('participacion_timer_end_at' in resto) {
            setParticipationTimerEndAt(((resto as any).participacion_timer_end_at as string | null) ?? null)
          }
          if ('participacion_timer_default_minutes' in resto) {
            setParticipationTimerDefaultMinutes(Number((resto as any).participacion_timer_default_minutes ?? 5) || 5)
          }
          setStep('ok')
        } else {
          setErrorMsg(data.error || 'Acceso no autorizado')
          setStep('error')
        }
      })
      .catch(() => {
        setErrorMsg('Error de conexión. Intenta recargar la página.')
        setStep('error')
      })
  }, [codigo, token])

  // Poll independiente del estado de preguntas/asistencia: solo del cronómetro (DB).
  useEffect(() => {
    if (step !== 'ok' || !asamblea?.asamblea_id) return

    const fetchTimer = async () => {
      try {
        const { data, error } = await supabase
          .from('asambleas')
          .select('participacion_timer_end_at, participacion_timer_default_minutes, participacion_timer_enabled')
          .eq('id', asamblea.asamblea_id)
          .single()
        if (error) return
        if (!data) return

        setParticipationTimerEndAt((data.participacion_timer_end_at as string | null) ?? null)
        setParticipationTimerDefaultMinutes(Number(data.participacion_timer_default_minutes ?? 5) || 5)
        setParticipationTimerEnabled(!!(data.participacion_timer_enabled ?? true))
      } catch {
        // Ignorar
      }
    }

    fetchTimer()
    const intervalId = window.setInterval(fetchTimer, 5000)
    return () => window.clearInterval(intervalId)
  }, [step, asamblea?.asamblea_id])

  // Contador local desde `participationTimerEndAt` (sin bloquear funcionalidades).
  useEffect(() => {
    if (typeof window === 'undefined') return

    const tick = () => {
      const defaultSeconds = Math.max(0, Math.floor(participationTimerDefaultMinutes * 60))

      if (!participationTimerEnabled) {
        // Timer deshabilitado: indicador no debe avanzar (y la UI se oculta), pero mantenemos estado estable.
        setParticipationTimerSecondsLeft(defaultSeconds)
        setParticipationTimerEnded(false)
        return
      }

      if (!participationTimerEndAt) {
        setParticipationTimerSecondsLeft(defaultSeconds)
        setParticipationTimerEnded(false)
        return
      }

      const endMs = Date.parse(participationTimerEndAt)
      if (!Number.isFinite(endMs)) {
        setParticipationTimerSecondsLeft(defaultSeconds)
        setParticipationTimerEnded(false)
        return
      }

      const remaining = Math.floor((endMs - Date.now()) / 1000)
      if (remaining <= 0) {
        setParticipationTimerSecondsLeft(defaultSeconds)
        setParticipationTimerEnded(false)
        return
      }

      setParticipationTimerSecondsLeft(remaining)
      setParticipationTimerEnded(false)
    }

    tick()

    const endMs = participationTimerEndAt ? Date.parse(participationTimerEndAt) : null
    if (endMs && Number.isFinite(endMs) && endMs > Date.now()) {
      const intervalId = window.setInterval(tick, 1000)
      return () => window.clearInterval(intervalId)
    }
    return
  }, [participationTimerEnabled, participationTimerEndAt, participationTimerDefaultMinutes])

  // Ajustar defaults en controles cuando el backend actualiza el default.
  useEffect(() => {
    setTimerDefaultDraftMinutes(participationTimerDefaultMinutes)
    setTimerStartDraftMinutes(participationTimerDefaultMinutes)
  }, [participationTimerDefaultMinutes])

  // ── Cargar unidades (ya_verifico según sesión actual; es_poder para etiqueta). Sandbox: demo o reales según sandbox_usar_unidades_reales; misma UI y ayuda para real y sandbox. ──
  const cargarUnidades = useCallback(async () => {
    if (!asamblea) return
    const silent = isBackgroundRefreshRef.current
    if (!silent) setCargandoUnidades(true)
    try {
      const soloDemo = asamblea.is_demo && !asamblea.sandbox_usar_unidades_reales
      let q = supabase
        .from('unidades')
        .select('id, torre, numero, nombre_propietario, email_propietario, coeficiente')
        .eq('organization_id', asamblea.organization_id)
        .order('torre', { ascending: true })
        .order('numero', { ascending: true })
      q = soloDemo ? q.eq('is_demo', true) : q.or('is_demo.eq.false,is_demo.is.null')
      const { data: todas } = await q

      const preguntaId = asamblea.verificacion_pregunta_id ?? null
      const { data: idsSesion } = await supabase.rpc('unidad_ids_verificados_sesion_actual', {
        p_asamblea_id: asamblea.asamblea_id,
        p_pregunta_id: preguntaId,
      })
      const verificadasSet = new Set<string>()
      const esPoderVerificados = new Map<string, boolean>()
      ;(idsSesion || []).forEach((r: { unidad_id?: string; es_poder?: boolean }) => {
        if (r.unidad_id) {
          verificadasSet.add(r.unidad_id)
          if (r.es_poder === true) esPoderVerificados.set(r.unidad_id, true)
        }
      })

      setUnidades(
        (todas || []).map((u: any) => ({
          id: u.id,
          torre: u.torre || 'S/T',
          numero: u.numero || 'S/N',
          nombre_propietario: u.nombre_propietario || 'S/N',
          email_propietario: u.email_propietario || '',
          coeficiente: Number(u.coeficiente) || 0,
          ya_verifico: verificadasSet.has(u.id),
          es_poder: esPoderVerificados.get(u.id) ?? false,
        }))
      )
    } finally {
      if (!silent) setCargandoUnidades(false)
      isBackgroundRefreshRef.current = false
    }
  }, [asamblea])

  // ── Cargar preguntas ─────────────────────────────────────────────────────
  const cargarPreguntas = useCallback(async () => {
    if (!asamblea) return
    const silent = isBackgroundRefreshRef.current
    if (!silent) setCargandoPreguntas(true)
    try {
      const { data: pregData } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, estado, tipo_votacion, umbral_aprobacion')
        .eq('asamblea_id', asamblea.asamblea_id)
        .eq('estado', 'abierta')
        .order('orden', { ascending: true })

      const pregIds = (pregData || []).map((p: any) => p.id)
      let opcMap: Record<string, Opcion[]> = {}
      if (pregIds.length > 0) {
        const { data: opcs } = await supabase
          .from('opciones_pregunta')
          .select('id, pregunta_id, texto_opcion, color, orden')
          .in('pregunta_id', pregIds)
          .order('orden', { ascending: true })
        ;(opcs || []).forEach((o: any) => {
          if (!opcMap[o.pregunta_id]) opcMap[o.pregunta_id] = []
          opcMap[o.pregunta_id].push(o)
        })
      }

      const nuevasPreguntas: Pregunta[] = (pregData || []).map((p: any) => ({
        id: p.id,
        texto_pregunta: p.texto_pregunta,
        estado: p.estado,
        tipo_votacion: p.tipo_votacion,
        umbral_aprobacion: p.umbral_aprobacion,
        opciones: opcMap[p.id] || [],
      }))
      setPreguntas(nuevasPreguntas)

      // Cargar votos ya registrados para esta asamblea (con es_poder para etiqueta "Poder")
      if (pregIds.length > 0) {
        const { data: votosData } = await supabase
          .from('votos')
          .select('unidad_id, pregunta_id, es_poder')
          .in('pregunta_id', pregIds)
        setVotosRegistrados((votosData || []).map((v: any) => ({
          unidad_id: v.unidad_id,
          pregunta_id: v.pregunta_id,
          es_poder: !!v.es_poder,
        })))
      }

      // Cargar avance de votaciones (estadísticas por pregunta para la gráfica)
      const conResultados: PreguntaConResultados[] = []
      for (const p of nuevasPreguntas) {
        const { data: statsData } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: p.id,
        })
        const rows = (statsData as Record<string, unknown>[] | null) ?? []
        const s = rows[0] as { resultados?: unknown } | undefined
        let resultados: ResultadoOpcionGrafica[] = []
        if (s?.resultados) {
          const raw = typeof s.resultados === 'string' ? JSON.parse(s.resultados as string || '[]') : s.resultados
          const arr = Array.isArray(raw) ? raw : []
          resultados = arr.map((r: Record<string, unknown>) => ({
            opcion_id: String(r.opcion_id ?? ''),
            opcion_texto: String(r.opcion_texto ?? r.texto_opcion ?? 'Opción'),
            color: String(r.color ?? '#6366f1'),
            votos_cantidad: Number(r.votos_cantidad ?? r.votos_count ?? 0),
            votos_coeficiente: Number(r.votos_coeficiente ?? 0),
            porcentaje_coeficiente_total: Number(r.porcentaje_coeficiente_total ?? r.porcentaje_coeficiente ?? 0),
            porcentaje_nominal_total: Number(r.porcentaje_nominal_total ?? r.porcentaje_nominal ?? 0),
          }))
        } else if (rows.length > 0) {
          // RPC devuelve una fila por opción (opcion_id, texto_opcion, color, votos_count, votos_coeficiente, porcentaje_nominal, porcentaje_coeficiente)
          resultados = rows.map((r: Record<string, unknown>) => ({
            opcion_id: String(r.opcion_id ?? ''),
            opcion_texto: String(r.texto_opcion ?? r.opcion_texto ?? 'Opción'),
            color: String(r.color ?? '#6366f1'),
            votos_cantidad: Number(r.votos_count ?? r.votos_cantidad ?? 0),
            votos_coeficiente: Number(r.votos_coeficiente ?? 0),
            porcentaje_coeficiente_total: Number(r.porcentaje_coeficiente ?? r.porcentaje_coeficiente_total ?? 0),
            porcentaje_nominal_total: Number(r.porcentaje_nominal ?? r.porcentaje_nominal_total ?? 0),
          }))
        }
        conResultados.push({
          id: p.id,
          texto_pregunta: p.texto_pregunta,
          tipo_votacion: p.tipo_votacion ?? 'coeficiente',
          umbral_aprobacion: p.umbral_aprobacion ?? null,
          resultados,
        })
      }
      setAvanceVotaciones(conResultados)

      if (nuevasPreguntas.length > 0 && !preguntaActiva) {
        setPreguntaActiva(nuevasPreguntas[0].id)
      }
    } finally {
      if (!silent) setCargandoPreguntas(false)
      isBackgroundRefreshRef.current = false
    }
  }, [asamblea, preguntaActiva])

  useEffect(() => {
    if (step === 'ok' && asamblea) {
      cargarUnidades()
      cargarPreguntas()
    }
  }, [step, asamblea, cargarUnidades, cargarPreguntas])

  // Cuando no hay pestañas, revalidar una vez (2 s) por si el admin acaba de activar verificación. No depender de asamblea completo para evitar bucle: revalidar actualiza asamblea y re-ejecutaba el efecto.
  useEffect(() => {
    if (step !== 'ok' || !asamblea) return
    if (asamblea.verificacion_asistencia_activa || preguntas.length > 0) return
    const t = setTimeout(() => revalidar(), 2000)
    return () => clearTimeout(t)
  }, [step, asamblea, preguntas.length, revalidar])

  // Refresco automático cada 1 min: revalidar en segundo plano (sin mostrar carga para que la tabla no desaparezca)
  useEffect(() => {
    if (step !== 'ok' || !asamblea) return
    const t = setInterval(() => {
      isBackgroundRefreshRef.current = true
      revalidar()
    }, 60000)
    return () => clearInterval(t)
  }, [step, asamblea, revalidar])

  // Pestaña por defecto y validez: asistencia solo si verificación activa, votación solo si hay pregunta abierta
  const mostrarTabAsistencia = !!asamblea?.verificacion_asistencia_activa
  const mostrarTabVotacion = preguntas.length > 0
  const tabsDisponibles = [
    ...(mostrarTabAsistencia ? [{ id: 'asistencia' as const, label: 'Registrar asistencia', icon: UserCheck }] : []),
    ...(mostrarTabVotacion ? [{ id: 'votacion' as const, label: 'Registrar votos', icon: Vote }] : []),
  ]
  useEffect(() => {
    if (!mostrarTabAsistencia && !mostrarTabVotacion) return
    if (tab === 'asistencia' && !mostrarTabAsistencia) setTab('votacion')
    else if (tab === 'votacion' && !mostrarTabVotacion) setTab('asistencia')
  }, [tab, mostrarTabAsistencia, mostrarTabVotacion])

  // ── Cronómetro de intervención (indicador) ─────────────────────────────
  const iniciarCronometro = async () => {
    if (!asamblea) return
    const minutos = Math.floor(Number(timerStartDraftMinutes))
    if (!Number.isFinite(minutos) || minutos < 1) return

    setTimerStarting(true)
    try {
      const res = await fetch('/api/delegado/participacion-timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asamblea.asamblea_id, token, minutes: minutos }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error al iniciar cronómetro')
      if (data.participacion_timer_end_at) setParticipationTimerEndAt(data.participacion_timer_end_at)
    } catch (e) {
      console.error(e)
    } finally {
      setTimerStarting(false)
    }
  }

  const guardarDefaultCronometro = async () => {
    if (!asamblea) return
    const minutos = Math.floor(Number(timerDefaultDraftMinutes))
    if (!Number.isFinite(minutos) || minutos < 1) return

    setTimerSavingDefault(true)
    try {
      const res = await fetch('/api/delegado/participacion-timer/set-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asamblea.asamblea_id, token, minutes: minutos }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Error al actualizar default')
      if (typeof data.participacion_timer_default_minutes === 'number') {
        setParticipationTimerDefaultMinutes(data.participacion_timer_default_minutes)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setTimerSavingDefault(false)
    }
  }

  // ── Asistencia ────────────────────────────────────────────────────────────
  const guardarAsistencia = async () => {
    if (selAsistencia.size === 0 || guardandoAsistencia || !asamblea) return
    setGuardandoAsistencia(true)
    setMsgAsistencia(null)
    try {
      const res = await fetch('/api/delegado/registrar-asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asamblea.asamblea_id, token, unidad_ids: Array.from(selAsistencia) }),
      })
      const data = await res.json()
      if (data.ok) {
        const n = data.registradas as number
        setUnidades((prev) => prev.map((u) => (selAsistencia.has(u.id) ? { ...u, ya_verifico: true } : u)))
        setSelAsistencia(new Set())
        setMsgAsistencia({ tipo: 'ok', texto: `✓ Asistencia registrada para ${n} unidad${n !== 1 ? 'es' : ''}.` })
      } else {
        setMsgAsistencia({ tipo: 'error', texto: data.error || 'Error al registrar asistencia.' })
      }
    } catch {
      setMsgAsistencia({ tipo: 'error', texto: 'Error de conexión.' })
    } finally {
      setGuardandoAsistencia(false)
    }
  }

  const quitarAsistenciaDelegado = async (unidadId: string) => {
    if (quitandoAsistenciaId || guardandoAsistencia || !asamblea) return
    setQuitandoAsistenciaId(unidadId)
    setMsgAsistencia(null)
    try {
      const res = await fetch('/api/delegado/quitar-asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asamblea.asamblea_id, token, unidad_ids: [unidadId] }),
      })
      const data = await res.json()
      if (data.ok) {
        setUnidades((prev) => prev.map((u) => (u.id === unidadId ? { ...u, ya_verifico: false } : u)))
        setMsgAsistencia({ tipo: 'ok', texto: 'Asistencia quitada. La unidad vuelve a pendientes de verificar.' })
      } else {
        setMsgAsistencia({ tipo: 'error', texto: data.error || 'Error al quitar asistencia.' })
      }
    } catch {
      setMsgAsistencia({ tipo: 'error', texto: 'Error de conexión.' })
    } finally {
      setQuitandoAsistenciaId(null)
    }
  }

  const unidadesFiltradas = (busq: string, excludeVerificadas = false) =>
    unidades.filter((u) => {
      if (excludeVerificadas && u.ya_verifico) return false
      if (!busq.trim()) return true
      const q = busq.toLowerCase()
      return `${u.torre} ${u.numero}`.toLowerCase().includes(q) || u.nombre_propietario.toLowerCase().includes(q)
    })

  // ── Votación ──────────────────────────────────────────────────────────────
  const yaVoto = (unidad_id: string, pregunta_id: string) =>
    votosRegistrados.some((v) => v.unidad_id === unidad_id && v.pregunta_id === pregunta_id)

  const preguntaActualObj = preguntas.find((p) => p.id === preguntaActiva)

  const unidadesSinVotar = unidades.filter((u) => !yaVoto(u.id, preguntaActiva))
    .filter((u) => {
      if (!busqVotacion.trim()) return true
      const q = busqVotacion.toLowerCase()
      return `${u.torre} ${u.numero}`.toLowerCase().includes(q) || u.nombre_propietario.toLowerCase().includes(q)
    })

  const guardarVotos = async () => {
    if (selVotacion.size === 0 || !opcionSeleccionada || guardandoVoto || !asamblea) return
    setGuardandoVoto(true)
    setMsgVotacion(null)
    let exitos = 0
    let errores = 0
    const unidadesAVotar = Array.from(selVotacion)
    for (const unidad_id of unidadesAVotar) {
      const unidad = unidades.find((u) => u.id === unidad_id)
      const res = await fetch('/api/delegado/registrar-voto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asamblea_id: asamblea.asamblea_id,
          token,
          unidad_id,
          votante_email: unidad?.email_propietario || 'asistente.delegado@sistema',
          votante_nombre: unidad?.nombre_propietario || 'Residente',
          votos: [{ pregunta_id: preguntaActiva, opcion_id: opcionSeleccionada }],
        }),
      })
      const data = await res.json()
      if (data.success) {
        exitos++
        setVotosRegistrados((prev) => [...prev, { unidad_id, pregunta_id: preguntaActiva }])
      } else {
        errores++
      }
    }
    setSelVotacion(new Set())
    setOpcionSeleccionada('')
    if (errores === 0) {
      setMsgVotacion({ tipo: 'ok', texto: `✓ ${exitos} voto${exitos !== 1 ? 's' : ''} registrado${exitos !== 1 ? 's' : ''} correctamente.` })
    } else {
      setMsgVotacion({ tipo: 'error', texto: `${exitos} voto${exitos !== 1 ? 's' : ''} registrado${exitos !== 1 ? 's' : ''}, ${errores} con error.` })
    }
    setGuardandoVoto(false)
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  if (step === 'validando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Validando acceso...</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-red-200 dark:border-red-800 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acceso no válido</h1>
          <p className="text-gray-600 dark:text-gray-400">{errorMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* Modal de ayuda para asistente delegado */}
      <Dialog open={showAyudaDelegado} onOpenChange={setShowAyudaDelegado}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Ayuda: modo asistente delegado
            </DialogTitle>
            <DialogDescription>
              Cómo registrar asistencia y votos en nombre de las unidades.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">¿Qué es el modo asistente delegado?</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Es un enlace seguro que el administrador te envió para que registres <strong>asistencia</strong> y <strong>votos</strong> en nombre de los propietarios o residentes que no pueden hacerlo por sí mismos. Todas las acciones quedan registradas en el acta como &quot;registrado por asistente delegado&quot;.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Registrar asistencia</h4>
              <p className="text-gray-600 dark:text-gray-400">
                En la pestaña <strong>Registrar asistencia</strong>: busca las unidades (por torre/apto o nombre), marca las que están presentes y pulsa <strong>Guardar asistencia</strong>. Puedes quitar la asistencia de una unidad con el botón correspondiente. Solo aparece esta pestaña si el administrador activó la verificación de quórum.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Registrar votos</h4>
              <p className="text-gray-600 dark:text-gray-400">
                En la pestaña <strong>Registrar votos</strong>: elige la pregunta activa, selecciona la opción de voto, marca las unidades que votan por esa opción y pulsa <strong>Registrar votos</strong>. Debes repetir el proceso por cada pregunta abierta y por cada opción que corresponda a distintas unidades.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Actualizar</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Usa el botón de actualizar (ícono de refresco) en la cabecera para recargar la lista de unidades y el estado de preguntas si el administrador abrió o cerró alguna.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{asamblea?.nombre_conjunto}</p>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">{asamblea?.nombre}</h1>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                Modo asistente delegado
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowAyudaDelegado(true)}
                className="p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
                title="Ayuda"
                aria-label="Ver ayuda"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { cargarUnidades(); cargarPreguntas() }}
                className="rounded-2xl border-gray-300 dark:border-gray-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {/* Tabs: solo si hay más de una pestaña disponible */}
          {tabsDisponibles.length > 1 && (
            <div className="flex w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              {tabsDisponibles.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    tab === id
                      ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-10 space-y-4">
        {/* Aviso de modo delegado */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Los registros quedarán marcados como <strong>registrados por asistente delegado</strong> en el acta y auditoría.</span>
        </div>

        {/* Cronómetro de intervención (indicador, no cierra preguntas) */}
        {participationTimerEnabled && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">Cronómetro de intervención</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums text-sm sm:text-base font-bold text-indigo-700 dark:text-indigo-300">
                {formatMMSS(participationTimerSecondsLeft)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Default (por asamblea)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timerDefaultDraftMinutes}
                  onChange={(e) => setTimerDefaultDraftMinutes(Number(e.target.value))}
                  className="w-20 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-2 py-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                  disabled={timerSavingDefault}
                  onClick={guardarDefaultCronometro}
                >
                  {timerSavingDefault ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Iniciar (esta vez)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timerStartDraftMinutes}
                  onChange={(e) => setTimerStartDraftMinutes(Number(e.target.value))}
                  className="w-20 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm px-2 py-1"
                />
                <Button
                  size="sm"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
                  disabled={timerStarting}
                  onClick={iniciarCronometro}
                >
                  {timerStarting ? 'Iniciando…' : 'Iniciar'}
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            No afecta la votación: solo es un indicador de tiempo para intervenciones.
          </p>
          </div>
        )}

        {/* Acceso rápido al panel: unidades y poderes (para actualizar datos o agregar poderes) */}
        {asamblea?.asamblea_id && asamblea?.organization_id && (
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">Gestión en el panel</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">Si necesitas actualizar información de unidades o agregar poderes, abre el panel del administrador:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/unidades?volver_asamblea=${asamblea.asamblea_id}&conjunto_id=${asamblea.organization_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Unidades
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>
              <Link
                href={`/dashboard/asambleas/${asamblea.asamblea_id}/poderes`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Poderes
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>
            </div>
          </div>
        )}

        {/* Sin pestañas disponibles */}
        {tabsDisponibles.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 p-6 text-center">
            <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Para registrar asistencia o votos, el administrador debe activar la verificación de asistencia o abrir al menos una pregunta de votación.
            </p>
            <Button variant="outline" size="sm" className="mt-4 rounded-2xl" onClick={() => revalidar()} disabled={revalidando}>
              <RefreshCw className={`w-4 h-4 mr-2 ${revalidando ? 'animate-spin' : ''}`} />
              {revalidando ? 'Comprobando…' : 'Actualizar'}
            </Button>
          </div>
        )}

        {/* ── TAB ASISTENCIA ── */}
        {mostrarTabAsistencia && tab === 'asistencia' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-indigo-600 px-5 py-4">
              <h2 className="text-white font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Registrar asistencia
              </h2>
              <p className="text-indigo-100 text-xs mt-0.5">Selecciona las unidades presentes y guarda su asistencia.</p>
            </div>

            <div className="p-4 space-y-3">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={busqAsistencia}
                  onChange={(e) => setBusqAsistencia(e.target.value)}
                  placeholder="Buscar unidad..."
                  className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Seleccionar/deseleccionar pendientes */}
              {!cargandoUnidades && unidades.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
                    onClick={() => {
                      const pendientes = unidadesFiltradas(busqAsistencia, true).map((u) => u.id)
                      const todasSel = pendientes.every((id) => selAsistencia.has(id))
                      if (todasSel) {
                        setSelAsistencia((p) => { const n = new Set(p); pendientes.forEach((id) => n.delete(id)); return n })
                      } else {
                        if (pendientes.length > 0 && !window.confirm('¿Está seguro de seleccionar todas las unidades mostradas?')) return
                        setSelAsistencia((p) => { const n = new Set(p); pendientes.forEach((id) => n.add(id)); return n })
                      }
                    }}
                  >
                    {unidadesFiltradas(busqAsistencia, true).every((u) => selAsistencia.has(u.id)) && unidadesFiltradas(busqAsistencia, true).length > 0
                      ? 'Deseleccionar todas'
                      : 'Seleccionar todas'}
                  </button>
                  <span className="text-gray-500">{selAsistencia.size} seleccionada{selAsistencia.size !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Lista */}
              {cargandoUnidades ? (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-indigo-500" />
                  Cargando unidades...
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {unidadesFiltradas(busqAsistencia).length === 0 ? (
                    <p className="text-center py-6 text-gray-400 text-sm">Sin resultados</p>
                  ) : (
                    unidadesFiltradas(busqAsistencia).map((u) => {
                      const disabled = u.ya_verifico
                      const checked = u.ya_verifico || selAsistencia.has(u.id)
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-colors ${
                            disabled
                              ? 'opacity-50 cursor-default'
                              : checked
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => !disabled && setSelAsistencia((p) => { const n = new Set(p); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n })}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {u.es_poder ? 'Poder · ' : ''}{u.torre !== 'S/T' ? `T${u.torre} · ` : ''}Apto {u.numero}
                            </span>
                            <span className="text-xs text-gray-500 ml-1.5 truncate">{u.nombre_propietario}</span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{u.coeficiente.toFixed(3)}%</span>
                          {u.ya_verifico && (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-2 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verificada
                              <button
                                type="button"
                                className="text-amber-600 dark:text-amber-400 hover:underline"
                                onClick={() => quitarAsistenciaDelegado(u.id)}
                                disabled={quitandoAsistenciaId === u.id || guardandoAsistencia}
                              >
                                {quitandoAsistenciaId === u.id ? 'Quitando...' : 'Quitar'}
                              </button>
                            </span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              )}

              {/* Feedback + Guardar */}
              {msgAsistencia && (
                <p className={`text-xs px-3 py-2 rounded-xl font-medium ${msgAsistencia.tipo === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'}`}>
                  {msgAsistencia.texto}
                </p>
              )}
              <Button
                onClick={guardarAsistencia}
                disabled={selAsistencia.size === 0 || guardandoAsistencia}
                className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
              >
                {guardandoAsistencia
                  ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  : <CheckCircle2 className="w-4 h-4" />}
                Guardar asistencia {selAsistencia.size > 0 && `(${selAsistencia.size})`}
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB VOTACIÓN ── */}
        {mostrarTabVotacion && tab === 'votacion' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Vote className="w-5 h-5" />
                Registrar votos
              </h2>
              <p className="text-indigo-100 text-xs mt-0.5">Selecciona la pregunta, la opción y las unidades a votar.</p>
            </div>

            <div className="p-4 space-y-4">
              {cargandoPreguntas ? (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-indigo-500" />
                  Cargando preguntas...
                </div>
              ) : preguntas.length === 0 ? (
                <div className="text-center py-8">
                  <Vote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No hay preguntas abiertas en este momento.</p>
                  <button type="button" onClick={cargarPreguntas} className="mt-2 text-xs text-indigo-600 underline">Actualizar</button>
                </div>
              ) : (
                <>
                  {/* Seleccionar pregunta */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Pregunta</label>
                    <div className="space-y-2">
                      {preguntas.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setPreguntaActiva(p.id); setOpcionSeleccionada(''); setSelVotacion(new Set()); setMsgVotacion(null) }}
                          className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-colors ${
                            preguntaActiva === p.id
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 text-indigo-800 dark:text-indigo-200'
                              : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {p.texto_pregunta}
                        </button>
                      ))}
                    </div>
                  </div>

                  {preguntaActualObj && (
                    <>
                      {/* Opciones */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Opción a votar</label>
                        <div className="flex flex-wrap gap-2">
                          {preguntaActualObj.opciones.map((opc) => (
                            <button
                              key={opc.id}
                              type="button"
                              onClick={() => setOpcionSeleccionada(opc.id)}
                              className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                                opcionSeleccionada === opc.id
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-md scale-105'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'
                              }`}
                            >
                              {opc.texto_opcion}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Unidades sin votar */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidades a votar</label>
                          <span className="text-xs text-gray-400">{unidadesSinVotar.length} pendientes</span>
                        </div>

                        {/* Buscador unidades */}
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={busqVotacion}
                            onChange={(e) => setBusqVotacion(e.target.value)}
                            placeholder="Buscar unidad..."
                            className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Seleccionar todas */}
                        {unidadesSinVotar.length > 0 && (
                          <div className="flex items-center justify-between text-xs mb-2">
                            <button
                              type="button"
                              className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
                              onClick={() => {
                                const ids = unidadesSinVotar.map((u) => u.id)
                                const todasSel = ids.every((id) => selVotacion.has(id))
                                if (todasSel) setSelVotacion(new Set())
                                else {
                                  if (ids.length > 0 && !window.confirm('¿Está seguro de seleccionar todas las unidades para registrar el voto?')) return
                                  setSelVotacion(new Set(ids))
                                }
                              }}
                            >
                              {unidadesSinVotar.every((u) => selVotacion.has(u.id)) && unidadesSinVotar.length > 0
                                ? 'Deseleccionar todas'
                                : 'Seleccionar todas'}
                            </button>
                            <span className="text-gray-500">{selVotacion.size} seleccionada{selVotacion.size !== 1 ? 's' : ''}</span>
                          </div>
                        )}

                        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                          {unidadesSinVotar.length === 0 ? (
                            <div className="text-center py-4">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                              <p className="text-sm text-gray-500">Todas las unidades ya votaron en esta pregunta.</p>
                            </div>
                          ) : (
                            unidadesSinVotar.map((u) => (
                              <label
                                key={u.id}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-colors border ${
                                  selVotacion.has(u.id)
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
                                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selVotacion.has(u.id)}
                                  onChange={() => setSelVotacion((p) => { const n = new Set(p); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n })}
                                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {(() => {
                                      const votoReg = votosRegistrados.find((v) => v.unidad_id === u.id && v.pregunta_id === preguntaActiva)
                                      return votoReg?.es_poder ? 'Poder · ' : ''
                                    })()}{u.torre !== 'S/T' ? `T${u.torre} · ` : ''}Apto {u.numero}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-1.5 truncate">{u.nombre_propietario}</span>
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">{u.coeficiente.toFixed(3)}%</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Feedback + Guardar */}
                      {msgVotacion && (
                        <p className={`text-xs px-3 py-2 rounded-xl font-medium ${msgVotacion.tipo === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'}`}>
                          {msgVotacion.texto}
                        </p>
                      )}

                      {(!opcionSeleccionada || selVotacion.size === 0) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                          {!opcionSeleccionada ? 'Selecciona una opción de voto' : 'Selecciona al menos una unidad'}
                        </p>
                      )}

                      <Button
                        onClick={guardarVotos}
                        disabled={selVotacion.size === 0 || !opcionSeleccionada || guardandoVoto}
                        className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2"
                      >
                        {guardandoVoto
                          ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          : <Vote className="w-4 h-4" />}
                        Registrar {selVotacion.size > 0 ? `${selVotacion.size} voto${selVotacion.size !== 1 ? 's' : ''}` : 'votos'}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Resumen general */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 px-5 py-4 text-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-500 font-semibold text-xs uppercase tracking-wide">
            <Users className="w-4 h-4" />
            Resumen
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {unidades.filter((u) => u.ya_verifico).length}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-300">Con asistencia</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-3">
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                {unidades.filter((u) => !u.ya_verifico).length}
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300">Pendientes de verificar</p>
            </div>
          </div>
        </div>

        {/* Avance de votaciones (gráfica como en Acceso / Votos) */}
        {avanceVotaciones.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Vote className="w-5 h-5" />
                Avance de votaciones
              </h2>
              <p className="text-indigo-100 text-xs mt-0.5">Resultados en tiempo real de las preguntas abiertas.</p>
            </div>
            <div className="p-4 space-y-6">
              {avanceVotaciones.map((preg) => {
                const pctRelevante = (r: ResultadoOpcionGrafica) =>
                  preg.tipo_votacion === 'nominal' ? (r.porcentaje_nominal_total ?? 0) : r.porcentaje_coeficiente_total
                const maxLabelLen = 18
                const data: BarChartData[] = preg.resultados.map((r) => {
                  const pct = pctRelevante(r)
                  const texto = r.opcion_texto || ''
                  return {
                    name: texto.length > maxLabelLen + 2 ? texto.slice(0, maxLabelLen) + '…' : texto,
                    fullName: texto,
                    porcentaje: Math.round(pct * 100) / 100,
                    votosCantidad: r.votos_cantidad,
                    color: r.color,
                    aprueba: preg.umbral_aprobacion != null && pct >= preg.umbral_aprobacion,
                  }
                })
                const umbral = preg.umbral_aprobacion ?? 51
                if (data.length === 0) return null
                return (
                  <div key={preg.id} className="space-y-2 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                      {preg.texto_pregunta}
                    </p>
                    <div className="h-[280px] min-h-[200px] w-full overflow-x-auto overflow-y-hidden -mx-1 px-1">
                      <div className="h-full min-w-[260px] w-full">
                        <VotacionBarChart
                          data={data}
                          umbral={umbral}
                          tipoVotacion={preg.tipo_votacion}
                          variant="panel"
                        />
                      </div>
                    </div>
                    {data.some((d) => d.aprueba) && (
                      <div className="flex flex-wrap gap-2">
                        {data.filter((d) => d.aprueba).map((d, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-1 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700"
                          >
                            Mayoría alcanzada — {d.name}: {d.porcentaje}% ({d.votosCantidad} {d.votosCantidad !== 1 ? 'votos' : 'voto'})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
