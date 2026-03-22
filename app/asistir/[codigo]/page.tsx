'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CheckCircle2, UserCheck, Vote, Search, RefreshCw, AlertTriangle, Users, HelpCircle, Settings2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { BarChartData } from '@/components/charts/VotacionBarChart'
import { normalizeCodigoAccesoFromUrl } from '@/lib/codigoAcceso'
import { matchesUnidadBusquedaCompleta } from '@/lib/matchUnidadSearch'

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

/** Evita re-renders cuando el polling devuelve los mismos datos (misma forma que el servidor). */
function datosEquivalentes(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/** Intervalo de refresco en segundo plano (asamblea + unidades + votación); menos agresivo que el polling anterior. */
const POLL_MS_DELEGADO = 12_000

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AsistirPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const codigo = useMemo(
    () => normalizeCodigoAccesoFromUrl(params?.codigo as string | undefined),
    [params?.codigo]
  )
  const token = searchParams?.get('t') || ''

  const [step, setStep] = useState<'validando' | 'ok' | 'error'>('validando')
  const [asamblea, setAsamblea] = useState<AsambleaInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [tab, setTab] = useState<'asistencia' | 'votacion'>('asistencia')

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
  /** Una carga a la vez; si llegan más, se programa un repaso al terminar (evita listas cruzadas). */
  const cargarPreguntasInFlightRef = useRef(false)
  const cargarPreguntasPendienteRef = useRef(false)
  /** Si el repaso pendiente debe evitar spinners de carga (refresco automático). */
  const cargarPreguntasPendienteSilentRef = useRef(true)

  // Revalidar estado de la asamblea (verificación activa, pregunta_id) para actualizar pestañas sin recargar
  const revalidar = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent
    if (!codigo || !token) return
    try {
      if (!silent) setRevalidando(true)
      const r = await fetch('/api/delegado/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_asamblea: codigo, token }),
        cache: 'no-store',
      })
      const data = await r.json()
      if (data.ok) {
        const { ok: _o, participacion_timer_end_at: _te, participacion_timer_default_minutes: _td, participacion_timer_enabled: _ten, ...resto } = data
        const next = resto as AsambleaInfo
        setAsamblea((prev) => (prev && datosEquivalentes(prev, next) ? prev : next))
      }
    } catch {
      // No cambiar step para no expulsar al delegado; solo no actualizar
    } finally {
      if (!silent) setRevalidando(false)
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
          const { ok: _o, participacion_timer_end_at: _te, participacion_timer_default_minutes: _td, participacion_timer_enabled: _ten, ...resto } = data
          setAsamblea(resto as AsambleaInfo)
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

  // ── Cargar unidades (ya_verifico según sesión actual; es_poder para etiqueta). Sandbox: demo o reales según sandbox_usar_unidades_reales; misma UI y ayuda para real y sandbox. ──
  const cargarUnidades = useCallback(async (silent = false) => {
    if (!asamblea || !codigo || !token) return
    if (!silent) setCargandoUnidades(true)
    try {
      const res = await fetch('/api/delegado/unidades-y-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_asamblea: codigo, token }),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok || !Array.isArray(data.unidades)) {
        console.error('[asistir] unidades-y-verificacion:', data?.error || res.status)
        return
      }
      const nuevas = data.unidades as Unidad[]
      setUnidades((prev) => (datosEquivalentes(prev, nuevas) ? prev : nuevas))
    } finally {
      if (!silent) setCargandoUnidades(false)
    }
  }, [asamblea, codigo, token])

  // ── Cargar preguntas ─────────────────────────────────────────────────────
  const cargarPreguntas = useCallback(async (silent = false) => {
    if (!asamblea || !codigo || !token) return
    if (cargarPreguntasInFlightRef.current) {
      cargarPreguntasPendienteRef.current = true
      cargarPreguntasPendienteSilentRef.current = cargarPreguntasPendienteSilentRef.current && silent
      return
    }
    cargarPreguntasInFlightRef.current = true

    if (!silent) setCargandoPreguntas(true)
    try {
      const res = await fetch('/api/delegado/estado-votacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_asamblea: codigo, token }),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        console.error('[asistir] estado-votacion:', data?.error || res.status)
        return
      }

      const nuevasPreguntas: Pregunta[] = (data.preguntas || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        texto_pregunta: p.texto_pregunta as string,
        estado: (p.estado as string) || 'abierta',
        tipo_votacion: p.tipo_votacion as string,
        umbral_aprobacion: (p.umbral_aprobacion as number | null) ?? null,
        opciones: ((p.opciones as Opcion[]) || []).map((o) => ({
          id: o.id,
          texto_opcion: o.texto_opcion,
          color: o.color,
          orden: typeof o.orden === 'number' ? o.orden : 0,
        })),
      }))

      const nuevosVotos: VotoRegistrado[] = (data.votosRegistrados || []).map((v: Record<string, unknown>) => ({
        unidad_id: v.unidad_id as string,
        pregunta_id: v.pregunta_id as string,
        es_poder: !!v.es_poder,
      }))

      const nuevoAvance = (data.avanceVotaciones || []) as PreguntaConResultados[]

      let preguntasCambiaron = false
      setPreguntas((prev) => {
        if (datosEquivalentes(prev, nuevasPreguntas)) return prev
        preguntasCambiaron = true
        return nuevasPreguntas
      })
      if (preguntasCambiaron) {
        setPreguntaActiva((prev) => {
          if (nuevasPreguntas.length === 0) return ''
          if (prev && nuevasPreguntas.some((p) => p.id === prev)) return prev
          return nuevasPreguntas[0].id
        })
      }

      setVotosRegistrados((prev) => (datosEquivalentes(prev, nuevosVotos) ? prev : nuevosVotos))
      setAvanceVotaciones((prev) => (datosEquivalentes(prev, nuevoAvance) ? prev : nuevoAvance))
    } finally {
      if (!silent) setCargandoPreguntas(false)
      cargarPreguntasInFlightRef.current = false
      if (cargarPreguntasPendienteRef.current) {
        cargarPreguntasPendienteRef.current = false
        const rerunSilent = cargarPreguntasPendienteSilentRef.current
        cargarPreguntasPendienteSilentRef.current = true
        queueMicrotask(() => {
          void cargarPreguntas(rerunSilent)
        })
      }
    }
  }, [asamblea, codigo, token])

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

  // Refresco periódico: flags de asamblea + unidades + preguntas (en serie y sin spinners para no ocultar la tabla).
  useEffect(() => {
    if (step !== 'ok' || !asamblea) return
    const t = window.setInterval(() => {
      void (async () => {
        await revalidar({ silent: true })
        await cargarUnidades(true)
        await cargarPreguntas(true)
      })()
    }, POLL_MS_DELEGADO)
    return () => clearInterval(t)
  }, [step, asamblea, revalidar, cargarUnidades, cargarPreguntas])

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
      return matchesUnidadBusquedaCompleta(u, busq)
    })

  // ── Votación ──────────────────────────────────────────────────────────────
  const yaVoto = (unidad_id: string, pregunta_id: string) =>
    votosRegistrados.some((v) => v.unidad_id === unidad_id && v.pregunta_id === pregunta_id)

  const preguntaActualObj = preguntas.find((p) => p.id === preguntaActiva)

  const unidadesSinVotar = unidades.filter((u) => !yaVoto(u.id, preguntaActiva))
    .filter((u) => matchesUnidadBusquedaCompleta(u, busqVotacion))

  const guardarVotos = async () => {
    if (selVotacion.size === 0 || !opcionSeleccionada || guardandoVoto || !asamblea) return
    setGuardandoVoto(true)
    setMsgVotacion(null)
    const unidadesAVotar = Array.from(selVotacion)
    try {
      const res = await fetch('/api/delegado/registrar-voto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asamblea_id: asamblea.asamblea_id,
          token,
          unidad_ids: unidadesAVotar,
          votos: [{ pregunta_id: preguntaActiva, opcion_id: opcionSeleccionada }],
        }),
      })
      const data = await res.json().catch(() => ({}))
      const results = Array.isArray(data.results) ? (data.results as { success?: boolean; unidad_id?: string; pregunta_id?: string }[]) : []
      const ok = results.filter((r) => r.success && r.unidad_id)
      const nOk = ok.length
      const nFail = Math.max(0, results.length - nOk)
      if (nOk > 0) {
        setVotosRegistrados((prev) => [
          ...prev,
          ...ok.map((r) => ({ unidad_id: r.unidad_id!, pregunta_id: r.pregunta_id || preguntaActiva })),
        ])
      }
      setSelVotacion(new Set())
      setOpcionSeleccionada('')
      if (res.ok && data.success) {
        setMsgVotacion({ tipo: 'ok', texto: `✓ ${nOk} voto${nOk !== 1 ? 's' : ''} registrado${nOk !== 1 ? 's' : ''} correctamente.` })
      } else if (res.ok && nOk > 0) {
        setMsgVotacion({
          tipo: 'error',
          texto: `Registro parcial: ${nOk} correcto${nOk !== 1 ? 's' : ''} · ${nFail} fallo${nFail !== 1 ? 's' : ''}.`,
        })
      } else {
        setMsgVotacion({ tipo: 'error', texto: (data.error as string) || 'No se pudieron registrar los votos.' })
      }
      void cargarPreguntas(true)
    } catch {
      setMsgVotacion({ tipo: 'error', texto: 'Error de conexión.' })
    } finally {
      setGuardandoVoto(false)
    }
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
                En la pestaña <strong>Registrar asistencia</strong>: busca por torre y apartamento, solo por número (conjuntos sin torre), nombre o correo del propietario; marca las que están presentes y pulsa <strong>Guardar asistencia</strong>. Puedes quitar la asistencia de una unidad con el botón correspondiente. Solo aparece esta pestaña si el administrador activó la verificación de quórum.
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
                  placeholder="Torre+número, solo número, nombre o correo…"
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
                  <button type="button" onClick={() => void cargarPreguntas()} className="mt-2 text-xs text-indigo-600 underline">Actualizar</button>
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
                            placeholder="Torre+número, solo número, nombre o correo…"
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
                    coeficienteSum: r.votos_coeficiente,
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
                            Mayoría alcanzada — {d.name}:{' '}
                            {preg.tipo_votacion === 'nominal' ? (
                              <>
                                {d.porcentaje}% · {d.votosCantidad}{' '}
                                {d.votosCantidad !== 1 ? 'unidades' : 'unidad'}
                              </>
                            ) : (
                              <>
                                {d.porcentaje}% del conjunto · {d.votosCantidad}{' '}
                                {d.votosCantidad !== 1 ? 'unidades' : 'unidad'}
                              </>
                            )}
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
