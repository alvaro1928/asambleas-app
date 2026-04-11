'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, AlertTriangle, Vote, Users, ChevronRight, ChevronDown, ChevronUp, BarChart3, Clock, RefreshCw, History, LogOut, FileDown, XCircle, UserCheck, HelpCircle, QrCode, Copy, FileText, Upload, Loader2, Ban, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'
import { buildPublicVotarUrl } from '@/lib/publicVotarUrl'
import { normalizeCodigoAccesoFromUrl } from '@/lib/codigoAcceso'
import { FOCUS_REFRESH_MIN_MS, POLL_MS_FLAGS, POLL_MS_HEAVY, shouldSkipFocusRefresh } from '@/lib/votacion-live'
import dynamic from 'next/dynamic'

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((m) => ({ default: m.QRCodeSVG })),
  { ssr: false, loading: () => <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-xl min-w-[160px] min-h-[160px] sm:min-w-[200px] sm:min-h-[200px]" /> }
)

const STORAGE_EMAIL_KEY = (codigo: string) => `votar_email_${codigo}`
const STORAGE_SESSION_STATE_KEY = (codigo: string) => `votar_session_state_${codigo}`
const STORAGE_SESSION_TTL_MS = 12 * 60 * 60 * 1000

type StoredVotarSessionState = {
  step: 'consentimiento' | 'votar'
  consentimientoAceptado: boolean
  ts: number
}

/** Umbral por defecto según Ley 675: mayoría simple (>50%) — 51% para aprobación */
const UMBRAL_APROBACION_DEFECTO = 51

// Cronómetro visual de participación (solo UI, sin bloquear votaciones ni enviar cambios al backend)
const DEFAULT_TIEMPO_PARTICIPACION_SECONDS = 5 * 60

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function mensajeErrorAmigable(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('no se encontraron unidades') || m.includes('length === 0')) return 'Este correo, teléfono o identificación no está asociado a ninguna unidad en esta asamblea. Revisa el dato o contacta al administrador.'
  if (m.includes('no puede votar') || m.includes('puede_votar')) return 'No tienes permiso para votar en esta asamblea con este correo, teléfono o identificación. Verifica que tengas una unidad o poder asignado.'
  if (m.includes('código') && m.includes('inválido')) return 'El código de acceso no es válido. Verifica que hayas escaneado correctamente el QR o que el enlace sea el indicado.'
  if (m.includes('acceso') && m.includes('cerrado')) return 'El acceso a esta votación está cerrado. Contacta al administrador si crees que es un error.'
  if (m.includes('desactivado') && m.includes('acceso')) return 'El acceso público a esta asamblea está desactivado. El administrador debe volver a activar la votación desde el panel.'
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'No hay conexión estable o el servidor respondió mal. Comprueba datos/Wi‑Fi, reintenta o recarga la página.'
  return msg
}

interface AsambleaInfo {
  asamblea_id: string
  nombre: string
  fecha: string
  organization_id: string
  nombre_conjunto: string
  acceso_valido: boolean
  mensaje: string
  participacion_timer_end_at?: string | null
  participacion_timer_default_minutes?: number
  participacion_timer_enabled?: boolean | null
  session_mode?: 'inactive' | 'verification' | 'voting'
  session_seq?: number
}

interface UnidadInfo {
  id: string
  torre: string
  numero: string
  coeficiente: number
  es_poder: boolean
  /** Fila `poderes.id` cuando el votante actúa por poder; null si es unidad propia. */
  poder_id?: string | null
  nombre_otorgante?: string
}

interface OpcionPregunta {
  id: string
  texto: string
  color: string
}

interface Pregunta {
  id: string
  texto_pregunta: string
  descripcion?: string
  tipo_votacion: string
  estado: string
  opciones: OpcionPregunta[]
  umbral_aprobacion?: number | null
}

interface VotoActual {
  pregunta_id: string
  unidad_id: string
  opcion_id: string
  opcion_texto: string
}

interface EstadisticasPregunta {
  total_votos: number
  total_coeficiente: number
  coeficiente_total_conjunto?: number
  porcentaje_participacion?: number
  tipo_votacion?: string
  resultados: Array<{
    opcion_id: string
    opcion_texto: string
    votos_cantidad: number
    votos_coeficiente: number
    porcentaje_cantidad?: number
    porcentaje_coeficiente?: number
    porcentaje_votos_emitidos?: number
    porcentaje_coeficiente_emitido?: number
    porcentaje_coeficiente_total?: number
    porcentaje_nominal_total?: number
  }>
}

/** Porcentaje a usar según tipo de votación (nominal vs coeficiente) */
function pctRelevante(r: { porcentaje_nominal_total?: number; porcentaje_votos_emitidos?: number; porcentaje_coeficiente_total?: number; porcentaje_coeficiente?: number }, tipo: string): number {
  return tipo === 'nominal'
    ? (r.porcentaje_nominal_total ?? r.porcentaje_votos_emitidos ?? 0)
    : (r.porcentaje_coeficiente_total ?? r.porcentaje_coeficiente ?? 0)
}

export default function VotacionPublicaPage() {
  const params = useParams()
  const codigo = useMemo(
    () => normalizeCodigoAccesoFromUrl(params.codigo as string | undefined),
    [params.codigo]
  )
  const toast = useToast()

  const [step, setStep] = useState<'validando' | 'email' | 'verificando' | 'consentimiento' | 'rechazo_consentimiento' | 'votar' | 'error'>('validando')
  const router = useRouter()
  const [asamblea, setAsamblea] = useState<AsambleaInfo | null>(null)
  const [email, setEmail] = useState('')
  const [unidades, setUnidades] = useState<UnidadInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Estados para votación
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [preguntasCerradas, setPreguntasCerradas] = useState<Pregunta[]>([])
  const [votosActuales, setVotosActuales] = useState<VotoActual[]>([])
  const [votosHistorico, setVotosHistorico] = useState<VotoActual[]>([])
  const [estadisticas, setEstadisticas] = useState<Record<string, EstadisticasPregunta>>({})
  const [estadisticasCerradas, setEstadisticasCerradas] = useState<Record<string, EstadisticasPregunta>>({})
  /** Unidades del censo (conjunto); para mostrar X/Y y sin votar por pregunta (mismo criterio que Acceso). */
  const [totalUnidadesConjunto, setTotalUnidadesConjunto] = useState<number | null>(null)
  const [votando, setVotando] = useState<string | null>(null)
  const [recargando, setRecargando] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [descargandoCertificado, setDescargandoCertificado] = useState(false)
  const [showModalCertificado, setShowModalCertificado] = useState(false)
  const [clientIp, setClientIp] = useState<string | null>(null)
  const [consentimientoAceptado, setConsentimientoAceptado] = useState(false)
  const [guardandoConsentimiento, setGuardandoConsentimiento] = useState(false)
  const [avanceColapsado, setAvanceColapsado] = useState(false)
  /** Modal de ayuda al votante; misma UI y ayuda para asambleas reales y sandbox. */
  const [showAyudaVotar, setShowAyudaVotar] = useState(false)
  const [showVotanteMenu, setShowVotanteMenu] = useState(false)
  /** Modo de sesión en tiempo casi real (inactive / verification / voting) */
  const [sessionModeLive, setSessionModeLive] = useState<'inactive' | 'verification' | 'voting'>('inactive')
  /** Solo verificación: acceso aceptado sin preguntas abiertas hasta que el admin pase a votación */
  const [soloSesionVerificacion, setSoloSesionVerificacion] = useState(false)
  /** URL de la página de votación (origen + /votar/codigo) para mostrar QR y copiar enlace; solo en cliente */
  const [urlVotacionCompartir, setUrlVotacionCompartir] = useState('')
  const [copiandoEnlace, setCopiandoEnlace] = useState(false)

  /** Evita closure obsoleto en setInterval (móvil/Safari) y permite saber el paso actual al volver a la pestaña */
  const stepRef = useRef(step)
  stepRef.current = step
  const autoRehydrateTriedRef = useRef(false)

  /**
   * Una sola carga a la vez. Si llega otra (polling, refresco), se marca pendiente y al terminar se vuelve a cargar.
   * NO usar AbortController en el fetch: cancelaba cada 3s antes de completar y la lista quedaba pegada.
   */
  const cargarPreguntasInFlightRef = useRef(false)
  const cargarPreguntasPendienteRef = useRef(false)
  const pollingPesadoInFlightRef = useRef(false)
  const ultimaRecargaPesadaRef = useRef(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && codigo) {
      setUrlVotacionCompartir(buildPublicVotarUrl(codigo))
    }
  }, [codigo])

  const saveStoredSessionState = (next: StoredVotarSessionState) => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(STORAGE_SESSION_STATE_KEY(codigo), JSON.stringify(next))
    } catch {
      // Ignorar storage errors
    }
  }

  const readStoredSessionState = (): StoredVotarSessionState | null => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem(STORAGE_SESSION_STATE_KEY(codigo))
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<StoredVotarSessionState>
      if (!parsed || (parsed.step !== 'consentimiento' && parsed.step !== 'votar')) return null
      if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > STORAGE_SESSION_TTL_MS) {
        localStorage.removeItem(STORAGE_SESSION_STATE_KEY(codigo))
        return null
      }
      return {
        step: parsed.step,
        consentimientoAceptado: !!parsed.consentimientoAceptado,
        ts: parsed.ts,
      }
    } catch {
      return null
    }
  }

  const clearStoredSession = (codigoLocal: string) => {
    try {
      if (typeof window === 'undefined') return
      localStorage.removeItem(STORAGE_EMAIL_KEY(codigoLocal))
      localStorage.removeItem(STORAGE_SESSION_STATE_KEY(codigoLocal))
    } catch {
      // Ignorar storage errors
    }
  }

  // --- Verificación de Quórum ---
  const [verificacionActiva, setVerificacionActiva] = useState(false)
  const verificacionActivaRef = useRef(false)
  /** Transición apagado→encendido de verificación: pedir de nuevo confirmación de asistencia. */
  const prevVerificacionActivaRef = useRef(false)
  /** Evita resetear yaVerifico en la primera lectura tras montar (refs inician en false). */
  const primeraLecturaVerificacionRef = useRef(true)
  const [yaVerifico, setYaVerifico] = useState(false)
  const [verificando, setVerificando] = useState(false)
  interface StatsVerif { total_verificados: number; coeficiente_verificado: number; porcentaje_verificado: number; quorum_alcanzado: boolean }
  const [statsVerificacion, setStatsVerificacion] = useState<StatsVerif | null>(null)
  /** Quórum verificado por pregunta (para tab Avance: cada pregunta muestra su quórum) */
  // --- Tabs ---
  const [tabActivo, setTabActivo] = useState<'votacion' | 'avance' | 'poderes' | 'misdatos'>('votacion')

  /** Declaración de poder recibido (pendiente de verificación en dashboard) */
  const [unidadesDelegacionOpciones, setUnidadesDelegacionOpciones] = useState<
    Array<{ id: string; torre: string; numero: string; nombre_propietario: string | null }>
  >([])
  const [cargandoDelegacion, setCargandoDelegacion] = useState(false)
  const [poderOtorganteId, setPoderOtorganteId] = useState('')
  const [nombreReceptorPoder, setNombreReceptorPoder] = useState('')
  const [observacionesPoder, setObservacionesPoder] = useState('')
  const [archivoPoderVotante, setArchivoPoderVotante] = useState<File | null>(null)
  const [enviandoPoderPendiente, setEnviandoPoderPendiente] = useState(false)
  const [misPoderesPendientes, setMisPoderesPendientes] = useState<
    Array<{
      id: string
      unidad_otorgante_torre: string
      unidad_otorgante_numero: string
      nombre_otorgante: string | null
      created_at: string
      archivo_poder: string | null
      observaciones: string | null
      coeficiente_delegado: number
    }>
  >([])
  const [cargandoMisPendientes, setCargandoMisPendientes] = useState(false)
  const [cancelandoPoderId, setCancelandoPoderId] = useState<string | null>(null)

  const cargarDatosMisDatosPoder = useCallback(async () => {
    if (!codigo || !email.trim()) return
    setCargandoDelegacion(true)
    setCargandoMisPendientes(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/votar/unidades-delegacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, ocultar_datos_propietario: true }),
        }),
        fetch('/api/votar/mis-poderes-pendientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, identificador: email.trim(), ocultar_datos_personales: true }),
        }),
      ])
      const j1 = (await r1.json().catch(() => ({}))) as {
        unidades?: Array<{ id: string; torre: string; numero: string; nombre_propietario: string | null }>
      }
      const j2 = (await r2.json().catch(() => ({}))) as {
        poderes?: Array<{
          id: string
          unidad_otorgante_torre: string
          unidad_otorgante_numero: string
          nombre_otorgante: string | null
          created_at: string
          archivo_poder: string | null
          observaciones: string | null
          coeficiente_delegado: number
        }>
      }
      if (r1.ok && Array.isArray(j1.unidades)) setUnidadesDelegacionOpciones(j1.unidades)
      if (r2.ok && Array.isArray(j2.poderes)) setMisPoderesPendientes(j2.poderes)
    } finally {
      setCargandoDelegacion(false)
      setCargandoMisPendientes(false)
    }
  }, [codigo, email])

  useEffect(() => {
    if (step !== 'votar') return
    if (tabActivo !== 'misdatos' && tabActivo !== 'poderes') return
    void cargarDatosMisDatosPoder()
  }, [step, tabActivo, cargarDatosMisDatosPoder])

  const enviarDeclaracionPoder = useCallback(async () => {
    if (!poderOtorganteId || !codigo || !email.trim()) {
      toast.error('Elige el apartamento que te otorgó el poder.')
      return
    }
    if (archivoPoderVotante && archivoPoderVotante.size > 2 * 1024 * 1024) {
      toast.error('El documento no puede superar 2 MB.')
      return
    }
    setEnviandoPoderPendiente(true)
    try {
      const fd = new FormData()
      fd.append('codigo', codigo)
      fd.append('identificador', email.trim())
      fd.append('unidad_otorgante_id', poderOtorganteId)
      if (nombreReceptorPoder.trim()) fd.append('nombre_receptor', nombreReceptorPoder.trim())
      if (observacionesPoder.trim()) fd.append('observaciones', observacionesPoder.trim())
      if (archivoPoderVotante) fd.append('archivo', archivoPoderVotante)
      const res = await fetch('/api/votar/registrar-poder-pendiente', { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string; mensaje?: string }
      if (!res.ok) {
        toast.error(data?.error || 'No se pudo enviar la solicitud')
        return
      }
      toast.success(data?.mensaje || 'Solicitud registrada')
      setPoderOtorganteId('')
      setObservacionesPoder('')
      setArchivoPoderVotante(null)
      await cargarDatosMisDatosPoder()
    } finally {
      setEnviandoPoderPendiente(false)
    }
  }, [
    poderOtorganteId,
    codigo,
    email,
    nombreReceptorPoder,
    observacionesPoder,
    archivoPoderVotante,
    cargarDatosMisDatosPoder,
    toast,
  ])

  const cancelarPoderPendiente = useCallback(
    async (poderId: string) => {
      if (!codigo || !email.trim()) return
      if (
        !window.confirm(
          '¿Cancelar esta solicitud? Podrás enviar una nueva más adelante si la necesitas. El administrador dejará de verla como pendiente.'
        )
      ) {
        return
      }
      setCancelandoPoderId(poderId)
      try {
        const res = await fetch('/api/votar/cancelar-poder-pendiente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigo,
            identificador: email.trim(),
            poder_id: poderId,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string; mensaje?: string }
        if (!res.ok) {
          toast.error(data.error || 'No se pudo cancelar la solicitud')
          return
        }
        toast.success(data.mensaje || 'Solicitud cancelada')
        await cargarDatosMisDatosPoder()
      } finally {
        setCancelandoPoderId(null)
      }
    },
    [codigo, email, cargarDatosMisDatosPoder, toast]
  )

  // Cronómetro de participación: estado puramente visual (no cambia reglas reales)
  const [participationTimerEndAt, setParticipationTimerEndAt] = useState<string | null>(null)
  const [participationTimerDefaultMinutes, setParticipationTimerDefaultMinutes] = useState<number>(5)
  const participationTimerDefaultSeconds = participationTimerDefaultMinutes * 60
  const [participationTimerSecondsLeft, setParticipationTimerSecondsLeft] = useState<number>(DEFAULT_TIEMPO_PARTICIPACION_SECONDS)
  const [participationTimerEnded, setParticipationTimerEnded] = useState(false)
  const [participationTimerEnabled, setParticipationTimerEnabled] = useState<boolean>(true)

  // Para marcar salida al cerrar/abandonar la página (solo sesiones activas en el registro)
  const salidaRef = useRef<{ asamblea_id: string; email: string } | null>(null)
  useEffect(() => {
    if (step === 'votar' && asamblea?.asamblea_id && email?.trim()) {
      salidaRef.current = { asamblea_id: asamblea.asamblea_id, email: email.trim() }
    } else {
      salidaRef.current = null
    }
  }, [step, asamblea?.asamblea_id, email])

  const marcarSalidaQuorum = () => {
    const payload = salidaRef.current
    if (!payload) return
    fetch('/api/marcar-salida-quorum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asamblea_id: payload.asamblea_id, email: payload.email }),
      keepalive: true
    }).catch(() => {})
  }

  const handleCerrarSesionVotante = () => {
    marcarSalidaQuorum()
    clearStoredSession(codigo)
    setShowVotanteMenu(false)
    setConsentimientoAceptado(false)
    setEmail('')
    setUnidades([])
    setPreguntas([])
    setPreguntasCerradas([])
    setVotosActuales([])
    setVotosHistorico([])
    setMisPoderesPendientes([])
    setUnidadesDelegacionOpciones([])
    setTabActivo('votacion')
    setError('')
    setStep('email')
    primeraLecturaVerificacionRef.current = true
    prevVerificacionActivaRef.current = false
    verificacionActivaRef.current = false
  }

  useEffect(() => {
    if (step !== 'votar' || !salidaRef.current) return
    const handleLeave = () => marcarSalidaQuorum()
    window.addEventListener('beforeunload', handleLeave)
    window.addEventListener('pagehide', handleLeave)
    return () => {
      window.removeEventListener('beforeunload', handleLeave)
      window.removeEventListener('pagehide', handleLeave)
    }
  }, [step])

  // Heartbeat cada 2 min para que el Registro de Ingresos solo muestre sesiones activas
  useEffect(() => {
    if (step !== 'votar' || !salidaRef.current) return
    const ping = () => {
      const payload = salidaRef.current
      if (!payload) return
      fetch('/api/ping-quorum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: payload.asamblea_id, email: payload.email })
      }).catch(() => {})
    }
    ping()
    const interval = setInterval(ping, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [step])

  useEffect(() => {
    if (!codigo) {
      setError('Enlace incompleto o código no válido en la URL.')
      setStep('error')
      return
    }
    autoRehydrateTriedRef.current = false
    validarCodigo()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when codigo changes
  }, [codigo])

  // Cronómetro visual: indicador sincronizado por backend.
  // - Si `participationTimerEndAt` está NULL o venció: muestra default (sin contar).
  // - Si está activo: cuenta regresivo hasta 00:00.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const tick = () => {
      const defaultSeconds = Math.max(0, Math.floor(participationTimerDefaultMinutes * 60))

      if (!participationTimerEnabled) {
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
        // Si llegó a 0: queda inactivo y vuelve a mostrar el default fijo.
        setParticipationTimerSecondsLeft(defaultSeconds)
        setParticipationTimerEnded(false)
        return
      }

      setParticipationTimerSecondsLeft(remaining)
      setParticipationTimerEnded(false)
    }

    tick()

    const endMs = participationTimerEndAt ? Date.parse(participationTimerEndAt) : null
    if (participationTimerEnabled && endMs && Number.isFinite(endMs) && endMs > Date.now()) {
      const intervalId = window.setInterval(tick, 1000)
      return () => window.clearInterval(intervalId)
    }
    return
  }, [participationTimerEnabled, participationTimerEndAt, participationTimerDefaultMinutes])

  const validarCodigo = async () => {
    const aplicarAsamblea = (asambleaData: AsambleaInfo) => {
      setAsamblea(asambleaData)
      setSessionModeLive(asambleaData.session_mode ?? 'inactive')
      setParticipationTimerEnabled(asambleaData.participacion_timer_enabled ?? true)
      setParticipationTimerEndAt(asambleaData.participacion_timer_end_at ?? null)
      setParticipationTimerDefaultMinutes(
        Number(asambleaData.participacion_timer_default_minutes ?? DEFAULT_TIEMPO_PARTICIPACION_SECONDS / 60) || 5
      )
      setStep('email')
      try {
        const guardado = typeof window !== 'undefined' && localStorage.getItem(STORAGE_EMAIL_KEY(codigo))
        if (guardado) setEmail(guardado)
      } catch {
        // Ignorar si localStorage no está disponible
      }
    }

    const interpretarFilaRpc = (row: Record<string, unknown>): AsambleaInfo => {
      const mode = (row.session_mode as string | undefined) ?? 'inactive'
      const m: 'inactive' | 'verification' | 'voting' =
        mode === 'voting' || mode === 'verification' ? mode : 'inactive'
      return {
        asamblea_id: String(row.asamblea_id ?? ''),
        nombre: String(row.nombre ?? ''),
        fecha: String(row.fecha ?? ''),
        organization_id: String(row.organization_id ?? ''),
        nombre_conjunto: String(row.nombre_conjunto ?? ''),
        acceso_valido: !!row.acceso_valido,
        mensaje: String(row.mensaje ?? ''),
        participacion_timer_end_at: (row.participacion_timer_end_at as string | null | undefined) ?? null,
        participacion_timer_default_minutes: Number(row.participacion_timer_default_minutes ?? 5) || 5,
        participacion_timer_enabled: row.participacion_timer_enabled as boolean | null | undefined,
        session_mode: m,
        session_seq: Number(row.session_seq ?? 1) || 1,
      }
    }

    try {
      /** Preferir API (service role): no depende de sesión Supabase en el navegador (misma causa que hardening móvil). */
      let usadoApi = false
      try {
        const res = await fetch('/api/votar/validar-codigo-acceso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo }),
          cache: 'no-store',
        })
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          asamblea?: Record<string, unknown>
          mensaje?: string
          error?: string
        }
        if (res.ok && json.ok && json.asamblea) {
          usadoApi = true
          aplicarAsamblea(interpretarFilaRpc(json.asamblea))
          return
        }
        if (!res.ok && (json.mensaje || json.error)) {
          clearStoredSession(codigo)
          setError(mensajeErrorAmigable(json.mensaje || json.error || 'Acceso denegado'))
          setStep('error')
          return
        }
      } catch {
        // red: intentar RPC en cliente
      }

      if (!usadoApi) {
        const { data, error } = await supabase.rpc('validar_codigo_acceso', {
          p_codigo: codigo,
        })

        if (error) throw error

        if (!data || data.length === 0) {
          clearStoredSession(codigo)
          setError(mensajeErrorAmigable('Código de acceso inválido'))
          setStep('error')
          return
        }

        const raw = data[0] as Record<string, unknown>
        const asambleaData = interpretarFilaRpc(raw)

        if (!asambleaData.acceso_valido) {
          clearStoredSession(codigo)
          setError(mensajeErrorAmigable(asambleaData.mensaje || 'Acceso denegado'))
          setStep('error')
          return
        }

        aplicarAsamblea(asambleaData)
      }
    } catch (error: unknown) {
      console.error('Error validando código:', error)
      const msg = error instanceof Error ? error.message : 'Error al validar el código de acceso'
      setError(mensajeErrorAmigable(msg))
      setStep('error')
    }
  }

  const handleValidarEmail = async () => {
    if (!email.trim()) {
      setError('Por favor ingresa tu email o número de teléfono')
      return
    }

    setLoading(true)
    setError('')

    try {
      const unidadesConInfo = await refrescarUnidades()
      
      if (unidadesConInfo.length === 0) {
        setError(mensajeErrorAmigable('No se encontraron unidades para este email o teléfono'))
        setLoading(false)
        return
      }

      try {
        if (typeof window !== 'undefined') localStorage.setItem(STORAGE_EMAIL_KEY(codigo), email.trim())
      } catch {
        // Ignorar
      }
      try {
        const res = await fetch('/api/client-info', { credentials: 'include' })
        const info = await res.json()
        if (info?.ip) setClientIp(info.ip)
      } catch {
        // Ignorar
      }
      const modeActual = asamblea?.session_mode ?? sessionModeLive
      if (modeActual === 'inactive') {
        setError(
          'El administrador aún no ha iniciado la sesión de verificación o votación. Vuelve a intentar cuando esté disponible.'
        )
        setLoading(false)
        return
      }

      const identificador = email.trim().toLowerCase()
      const consentRes = await fetch(
        `/api/votar/consentimiento?codigo=${encodeURIComponent(codigo)}&identificador=${encodeURIComponent(identificador)}`,
        { credentials: 'include' }
      )
      const consentData = consentRes.ok ? await consentRes.json().catch(() => ({})) : {}
      if (consentData.accepted) {
        saveStoredSessionState({ step: 'votar', consentimientoAceptado: true, ts: Date.now() })
        const stRes = await fetch('/api/votar/estado-verificacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, soloFlags: true }),
        })
        const stJson = await stRes.json().catch(() => ({} as { asamblea?: { session_mode?: string } }))
        const modeAfter =
          (stJson.asamblea?.session_mode as AsambleaInfo['session_mode']) || asamblea?.session_mode || sessionModeLive
        if (modeAfter) setSessionModeLive(modeAfter)
        if (modeAfter === 'voting') {
          setSoloSesionVerificacion(false)
          setStep('votar')
          await cargarPreguntas(unidadesConInfo)
        } else if (modeAfter === 'verification') {
          setSoloSesionVerificacion(true)
          setStep('votar')
        } else {
          setConsentimientoAceptado(false)
          saveStoredSessionState({ step: 'consentimiento', consentimientoAceptado: false, ts: Date.now() })
          setError(
            'La sesión pública se encuentra inactiva en este momento. Espera a que el administrador habilite verificación o votación.'
          )
          setStep('email')
        }
      } else {
        saveStoredSessionState({ step: 'consentimiento', consentimientoAceptado: false, ts: Date.now() })
        setConsentimientoAceptado(false)
        setStep('consentimiento')
      }
    } catch (error: any) {
      console.error('Error validando votante:', error)
      setError(mensajeErrorAmigable(error?.message || 'Error al validar el votante'))
    } finally {
      setLoading(false)
    }
  }

  const refrescarUnidades = async (): Promise<UnidadInfo[]> => {
    const identificador = email.trim().toLowerCase()
    const res = await fetch('/api/votar/validar-identificador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        codigo,
        identificador,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'No se pudo validar el identificador')
    }
    if (!data?.puede_votar || !Array.isArray(data?.unidades)) {
      return []
    }
    const unidadesConInfo: UnidadInfo[] = data.unidades

    setUnidades(unidadesConInfo)
    return unidadesConInfo
  }

  const handleAceptarConsentimiento = async () => {
    if (!consentimientoAceptado || !email.trim()) return
    setGuardandoConsentimiento(true)
    setError('')
    try {
      const identificador = email.trim().toLowerCase()
      const res = await fetch('/api/votar/consentimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          codigo,
          identificador,
          ip: clientIp ?? undefined,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          code?: string
        }
        if (res.status === 402 && data.code === 'INSUFFICIENT_TOKENS') {
          setError(
            'El administrador de tu conjunto no tiene créditos suficientes en la plataforma para completar esta aceptación en la sesión actual. Avísale para que recargue tokens e intenta de nuevo en unos minutos.'
          )
          return
        }
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Error al registrar la aceptación'
        )
        return
      }
      saveStoredSessionState({ step: 'votar', consentimientoAceptado: true, ts: Date.now() })
      const stRes = await fetch('/api/votar/estado-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, soloFlags: true }),
      })
      const stJson = await stRes.json().catch(() => ({} as { asamblea?: { session_mode?: string } }))
      const modeAfter =
        (stJson.asamblea?.session_mode as AsambleaInfo['session_mode']) || asamblea?.session_mode || sessionModeLive
      if (modeAfter) setSessionModeLive(modeAfter)
      if (modeAfter === 'voting') {
        setSoloSesionVerificacion(false)
        setStep('votar')
        await cargarPreguntas(unidades)
      } else if (modeAfter === 'verification') {
        setSoloSesionVerificacion(true)
        setStep('votar')
      } else {
        setConsentimientoAceptado(false)
        saveStoredSessionState({ step: 'consentimiento', consentimientoAceptado: false, ts: Date.now() })
        setError(
          'La sesión pública se encuentra inactiva en este momento. Espera a que el administrador habilite verificación o votación.'
        )
        setStep('email')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al continuar')
    } finally {
      setGuardandoConsentimiento(false)
    }
  }

  // Si ya validó previamente en este dispositivo para este código, rehidratar al refrescar
  useEffect(() => {
    if (!codigo || !asamblea?.asamblea_id) return
    if (step !== 'email' || loading) return
    if (!email.trim()) return
    if (autoRehydrateTriedRef.current) return

    const stored = readStoredSessionState()
    if (!stored) return

    autoRehydrateTriedRef.current = true
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const unidadesConInfo = await refrescarUnidades()
        if (unidadesConInfo.length === 0) {
          throw new Error('Sin unidades válidas en sesión')
        }
        const identificador = email.trim().toLowerCase()
        const consentRes = await fetch(
          `/api/votar/consentimiento?codigo=${encodeURIComponent(codigo)}&identificador=${encodeURIComponent(identificador)}`,
          { credentials: 'include' }
        )
        const consentData = consentRes.ok ? await consentRes.json().catch(() => ({})) : {}
        if (!consentData.accepted) {
          saveStoredSessionState({ step: 'consentimiento', consentimientoAceptado: false, ts: Date.now() })
          setConsentimientoAceptado(false)
          setStep('consentimiento')
          return
        }
        const stRes = await fetch('/api/votar/estado-verificacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, soloFlags: true }),
        })
        const stJson = await stRes.json().catch(() => ({} as { asamblea?: { session_mode?: string } }))
        const modeAfter =
          (stJson.asamblea?.session_mode as AsambleaInfo['session_mode']) || asamblea?.session_mode || sessionModeLive
        if (modeAfter) setSessionModeLive(modeAfter)
        if (modeAfter === 'voting') {
          setSoloSesionVerificacion(false)
          setConsentimientoAceptado(true)
          saveStoredSessionState({ step: 'votar', consentimientoAceptado: true, ts: Date.now() })
          setStep('votar')
          await cargarPreguntas(unidadesConInfo)
        } else if (modeAfter === 'verification') {
          setSoloSesionVerificacion(true)
          setConsentimientoAceptado(true)
          saveStoredSessionState({ step: 'votar', consentimientoAceptado: true, ts: Date.now() })
          setStep('votar')
        } else {
          setConsentimientoAceptado(false)
          saveStoredSessionState({ step: 'consentimiento', consentimientoAceptado: false, ts: Date.now() })
          setError(
            'La sesión pública se encuentra inactiva en este momento. Espera a que el administrador habilite verificación o votación.'
          )
          setStep('email')
        }
      } catch {
        clearStoredSession(codigo)
        setError('Tu sesión de votación expiró o cambió. Valida nuevamente tu dato para continuar.')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- controlled auto-rehydrate once
  }, [codigo, asamblea?.asamblea_id, step, email, loading])

  // Si el usuario rechaza consentimiento, limpiamos sesión guardada para evitar reentrada automática.
  useEffect(() => {
    if (step === 'rechazo_consentimiento' && codigo) {
      clearStoredSession(codigo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only on step/codigo change
  }, [step, codigo])

  const cargarPreguntas = async (unidadesParam?: UnidadInfo[]) => {
    if (!asamblea) return

    if (cargarPreguntasInFlightRef.current) {
      cargarPreguntasPendienteRef.current = true
      return
    }
    cargarPreguntasInFlightRef.current = true

    try {
      // Usar unidades del parámetro o del estado
      const unidadesParaUsar = unidadesParam || unidades

      /** Solo vía API (service role). El fallback con supabase.from() en el cliente fallaba tras RLS/hardening si había sesión authenticated de otra organización en el mismo navegador. */
      let preguntasConOpciones: Pregunta[] = []
      let cargadoPorApi = false
      for (let attempt = 0; attempt < 2 && !cargadoPorApi; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 450))
        try {
          const res = await fetch('/api/votar/preguntas-abiertas', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
            cache: 'no-store',
            body: JSON.stringify({ codigo }),
          })
          const json = (await res.json().catch(() => ({}))) as { preguntas?: Pregunta[] }
          if (res.ok && Array.isArray(json.preguntas)) {
            preguntasConOpciones = json.preguntas
            cargadoPorApi = true
          }
        } catch {
          // reintento en siguiente iteración
        }
      }

      if (!cargadoPorApi) {
        console.warn('[votar] No se pudieron cargar preguntas (API). Reintenta o recarga; sin lectura directa por cliente para evitar RLS cruzado.')
        setPreguntas([])
        setEstadisticas({})
        setVotosActuales([])
        return
      }

      if (!preguntasConOpciones || preguntasConOpciones.length === 0) {
        setPreguntas([])
        setEstadisticas({})
        setVotosActuales([])
        return
      }

      setPreguntas(preguntasConOpciones)

      // Cargar votos actuales del votante usando las unidades correctas
      if (unidadesParaUsar && unidadesParaUsar.length > 0) {
        await cargarVotosActuales(preguntasConOpciones.map(p => p.id), unidadesParaUsar)
      }

      // Cargar estadísticas
      await cargarEstadisticas(preguntasConOpciones.map(p => p.id))

    } catch (error: any) {
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return
      console.error('Error cargando preguntas:', error)
    } finally {
      cargarPreguntasInFlightRef.current = false
      if (cargarPreguntasPendienteRef.current) {
        cargarPreguntasPendienteRef.current = false
        queueMicrotask(() => {
          void cargarPreguntas()
        })
      }
    }
  }

  const cargarPreguntasRef = useRef(cargarPreguntas)
  cargarPreguntasRef.current = cargarPreguntas

  /**
   * Cuando el admin abre/cierra/archiva una pregunta, refrescar al instante (no solo cada POLL_MS_LIVE).
   * Requiere que `preguntas` esté en la publicación supabase_realtime (ver supabase/REALTIME-PREGUNTAS-VOTACION.sql).
   */
  useEffect(() => {
    if (!asamblea?.asamblea_id) return
    const enLive = step === 'consentimiento' || step === 'votar'
    if (!enLive) return

    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const debounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void cargarPreguntasRef.current()
      }, 250)
    }

    const channel = supabase
      .channel(`public:preguntas:asamblea:${asamblea.asamblea_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'preguntas',
          filter: `asamblea_id=eq.${asamblea.asamblea_id}`,
        },
        debounced
      )
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [asamblea?.asamblea_id, step])

  const cargarHistorial = async (unidadesParam?: UnidadInfo[]) => {
    if (!asamblea) return

    try {
      const unidadesParaUsar = unidadesParam || unidades

      // Cargar preguntas cerradas
      const { data: preguntasCerradasData, error: preguntasError } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, descripcion, tipo_votacion, estado, umbral_aprobacion')
        .eq('asamblea_id', asamblea.asamblea_id)
        .eq('estado', 'cerrada')
        .eq('is_archived', false)
        .order('created_at', { ascending: true }) // Orden de la asamblea: Pregunta 1, 2, 3...

      if (preguntasError) throw preguntasError

      if (!preguntasCerradasData || preguntasCerradasData.length === 0) {
        setPreguntasCerradas([])
        return
      }

      const cerradaIds = preguntasCerradasData.map((p: { id: string }) => p.id)
      const { data: opcionesCerradasData } = await supabase
        .from('opciones_pregunta')
        .select('id, pregunta_id, texto_opcion, color, orden')
        .in('pregunta_id', cerradaIds)
        .order('orden', { ascending: true })

      const opcionesPorCerrada: Record<string, { id: string; texto: string; color: string }[]> = {}
      for (const p of preguntasCerradasData) {
        opcionesPorCerrada[p.id] = []
      }
      for (const o of opcionesCerradasData || []) {
        const pid = (o as { pregunta_id: string }).pregunta_id
        if (opcionesPorCerrada[pid]) {
          opcionesPorCerrada[pid].push({
            id: o.id,
            texto: o.texto_opcion,
            color: o.color
          })
        }
      }

      const preguntasConOpciones: Pregunta[] = preguntasCerradasData.map((p: any) => ({
        ...p,
        opciones: opcionesPorCerrada[p.id] || []
      }))

      setPreguntasCerradas(preguntasConOpciones)

      // Cargar votos históricos por API (service role) para evitar vacíos por RLS/sesión cruzada.
      if (unidadesParaUsar && unidadesParaUsar.length > 0) {
        const unidadIds = unidadesParaUsar.map((u) => u.id)
        const votosRes = await fetch('/api/votar/votos-por-unidades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            codigo,
            preguntaIds: preguntasConOpciones.map((p) => p.id),
            unidadIds,
          }),
        })
        const votosJson = (await votosRes.json().catch(() => ({}))) as { votos?: VotoActual[] }
        setVotosHistorico(Array.isArray(votosJson.votos) ? votosJson.votos : [])
      }

      // Cargar estadísticas finales de preguntas cerradas
      await cargarEstadisticasCerradas(preguntasConOpciones.map(p => p.id))

    } catch (error: any) {
      // Ignorar errores de AbortError
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return
      console.error('Error cargando historial:', error)
    }
  }

  const cargarVotosActuales = async (preguntaIds: string[], unidadesParam?: UnidadInfo[]) => {
    const unidadesParaUsar = unidadesParam || unidades
    
    if (!unidadesParaUsar || unidadesParaUsar.length === 0) return

    try {
      const unidadIds = unidadesParaUsar.map((u) => u.id)
      const votosRes = await fetch('/api/votar/votos-por-unidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          codigo,
          preguntaIds,
          unidadIds,
        }),
      })
      const votosJson = (await votosRes.json().catch(() => ({}))) as { votos?: VotoActual[] }
      setVotosActuales(Array.isArray(votosJson.votos) ? votosJson.votos : [])
    } catch (error: any) {
      // Ignorar errores de AbortError
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return
      console.error('Error cargando votos actuales:', error)
    }
  }

  const fetchEstadisticasBatch = async (preguntaIds: string[]): Promise<Record<string, EstadisticasPregunta>> => {
    const res = await fetch('/api/votar/estadisticas-preguntas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ codigo, preguntaIds }),
    })
    const json = (await res.json().catch(() => ({}))) as { stats?: Record<string, EstadisticasPregunta> }
    if (!res.ok || !json.stats || typeof json.stats !== 'object') return {}
    return json.stats
  }

  const cargarEstadisticas = async (preguntaIds: string[]) => {
    try {
      if (asamblea?.asamblea_id && preguntaIds.length > 0) {
        const { data: qd } = await supabase.rpc('calcular_quorum_asamblea', {
          p_asamblea_id: asamblea.asamblea_id,
        })
        if (qd?.length) {
          setTotalUnidadesConjunto(
            Math.max(0, Number((qd[0] as { total_unidades?: number }).total_unidades))
          )
        }
      }

      const estadisticasMap: Record<string, EstadisticasPregunta> = {}
      const statsBatch = await fetchEstadisticasBatch(preguntaIds)
      for (const preguntaId of preguntaIds) {
        estadisticasMap[preguntaId] = statsBatch[preguntaId] ?? {
          total_votos: 0,
          total_coeficiente: 0,
          porcentaje_participacion: 0,
          tipo_votacion: 'coeficiente',
          resultados: [],
        }
      }

      setEstadisticas(estadisticasMap)
    } catch (error: unknown) {
      if (error instanceof Error && (error.message.includes('AbortError') || error.message.includes('aborted'))) return
      console.error('Error cargando estadísticas:', error)
    }
  }

  const cargarEstadisticasCerradas = async (preguntaIds: string[]) => {
    try {
      if (asamblea?.asamblea_id && preguntaIds.length > 0) {
        const { data: qd } = await supabase.rpc('calcular_quorum_asamblea', {
          p_asamblea_id: asamblea.asamblea_id,
        })
        if (qd?.length) {
          setTotalUnidadesConjunto(
            Math.max(0, Number((qd[0] as { total_unidades?: number }).total_unidades))
          )
        }
      }

      const estadisticasMap: Record<string, EstadisticasPregunta> = {}
      const statsBatch = await fetchEstadisticasBatch(preguntaIds)
      for (const preguntaId of preguntaIds) {
        const row = statsBatch[preguntaId]
        if (!row) continue
        estadisticasMap[preguntaId] = {
          total_votos: Number(row.total_votos) || 0,
          total_coeficiente: Number(row.total_coeficiente) || 0,
          coeficiente_total_conjunto: Number(row.coeficiente_total_conjunto) || 100,
          porcentaje_participacion: Number(row.porcentaje_participacion) || 0,
          tipo_votacion: row.tipo_votacion ?? 'coeficiente',
          resultados: Array.isArray(row.resultados) ? row.resultados : [],
        }
      }

      setEstadisticasCerradas(estadisticasMap)
    } catch (error: unknown) {
      // Ignorar errores de AbortError
      if (error instanceof Error && (error.message.includes('AbortError') || error.message.includes('aborted'))) return
      console.error('Error cargando estadísticas cerradas:', error)
    }
  }

  const refrescarDatos = async () => {
    setRecargando(true)
    try {
      const nuevasUnidades = await refrescarUnidades()
      await cargarPreguntas(nuevasUnidades)
      if (mostrarHistorial) {
        await cargarHistorial(nuevasUnidades)
      }
      if (asamblea?.asamblea_id) {
        await refrescarVerificacion(asamblea.asamblea_id, email.trim())
      }
    } catch (error: any) {
      console.error('Error refrescando datos:', error)
    } finally {
      setRecargando(false)
    }
  }

  const handleVotar = async (preguntaId: string, unidadId: string, opcionId: string) => {
    setVotando(preguntaId)

    try {
      const unidad = unidades.find(u => u.id === unidadId)
      if (!unidad) throw new Error('Unidad no encontrada')

      const poderIdVoto = unidad.es_poder ? unidad.poder_id ?? null : null

      let votoRegistrado = false
      try {
        const res = await fetch('/api/votar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            pregunta_id: preguntaId,
            opcion_id: opcionId,
            unidad_id: unidadId,
            votante_email: email.toLowerCase().trim(),
            votante_nombre: unidad.nombre_otorgante || 'Votante',
            es_poder: unidad.es_poder,
            poder_id: poderIdVoto,
          }),
        })
        if (res.ok) {
          votoRegistrado = true
        } else if (res.status !== 401) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || 'No se pudo registrar el voto')
        }
      } catch {
        // fallback controlado abajo
      }

      if (!votoRegistrado) {
        const { error } = await supabase.rpc('registrar_voto_con_trazabilidad', {
          p_pregunta_id: preguntaId,
          p_unidad_id: unidadId,
          p_opcion_id: opcionId,
          p_votante_email: email.toLowerCase().trim(),
          p_votante_nombre: unidad.nombre_otorgante || 'Votante',
          p_es_poder: unidad.es_poder,
          p_poder_id: poderIdVoto,
          p_ip_address: clientIp || null,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
        })
        if (error) throw error
      }

      // Si votó y aún no tenía asistencia verificada, marcarla automáticamente.
      // Cuando la verificación está cerrada, se registra en la última sesión cerrada.
      try {
        if (!yaVerifico && asamblea?.asamblea_id) {
          const verifyRes = await fetch('/api/votar/auto-verificar-asistencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              asamblea_id: asamblea.asamblea_id,
              identificador: email.trim(),
            }),
          })
          const verifyJson = await verifyRes.json().catch(() => ({}))
          if (verifyRes.ok && verifyJson?.ok) {
            setYaVerifico(true)
          }
        }
      } catch {
        // No bloquear voto por fallo de auto-verificación.
      }

      // Recargar votos actuales y estadísticas
      await cargarVotosActuales([preguntaId], unidades)
      await cargarEstadisticas([preguntaId])

      toast.success(`Voto registrado para ${unidad.torre} - ${unidad.numero}`)

    } catch (error: any) {
      console.error('Error al votar:', error)
      toast.error('Error al registrar el voto: ' + error.message)
    } finally {
      setVotando(null)
    }
  }

  // Poll ligero (solo flags + cronómetro): solo cuando NO corre el polling principal (consentimiento/votar + email).
  // Si corrieran ambos a la vez, duplicaríamos /api/votar/estado-verificacion cada 5 s.
  useEffect(() => {
    if (!asamblea?.asamblea_id || step === 'validando' || step === 'error') return
    const enPantallaConEmail =
      (step === 'consentimiento' || step === 'votar') && !!email.trim()
    if (enPantallaConEmail) return

    const fetchActiva = async () => {
      try {
        const res = await fetch('/api/votar/estado-verificacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, soloFlags: true }),
        })
        const json = await res.json().catch(() => ({} as { ok?: boolean; asamblea?: Record<string, unknown> }))
        type FlagsAsamblea = {
          verificacion_asistencia_activa?: boolean
          verificacion_pregunta_id?: string | null
          participacion_timer_end_at?: string | null
          participacion_timer_default_minutes?: number | null
          participacion_timer_enabled?: boolean | null
          session_mode?: 'inactive' | 'verification' | 'voting'
          session_seq?: number
        }
        let a: FlagsAsamblea | null = null
        if (res.ok && json.ok && json.asamblea) {
          a = json.asamblea as FlagsAsamblea
        } else {
          const { data } = await supabase
            .from('asambleas')
            .select(
              'verificacion_asistencia_activa, verificacion_pregunta_id, participacion_timer_end_at, participacion_timer_default_minutes, participacion_timer_enabled, session_mode, session_seq'
            )
            .eq('id', asamblea.asamblea_id)
            .single()
          if (data) a = data as FlagsAsamblea
        }
        if (a) {
          const activa = !!a.verificacion_asistencia_activa
          setVerificacionActiva(activa)
          setParticipationTimerEndAt(a.participacion_timer_end_at ?? null)
          setParticipationTimerDefaultMinutes(Number(a.participacion_timer_default_minutes ?? 5) || 5)
          setParticipationTimerEnabled(a.participacion_timer_enabled ?? true)
          if (a.session_mode === 'inactive' || a.session_mode === 'verification' || a.session_mode === 'voting') {
            setSessionModeLive(a.session_mode)
            setAsamblea((prev) =>
              prev ? { ...prev, session_mode: a.session_mode, session_seq: a.session_seq ?? prev.session_seq } : prev
            )
          }
          if (!primeraLecturaVerificacionRef.current && activa && !prevVerificacionActivaRef.current) setYaVerifico(false)
          primeraLecturaVerificacionRef.current = false
          prevVerificacionActivaRef.current = activa
          verificacionActivaRef.current = activa
        }
      } catch {
        // ignorar
      }
    }
    fetchActiva()
    const interval = setInterval(fetchActiva, POLL_MS_FLAGS)
    return () => clearInterval(interval)
  }, [asamblea?.asamblea_id, codigo, step, email])

  useEffect(() => {
    if (step !== 'votar' || !soloSesionVerificacion || !asamblea?.asamblea_id) return
    if (sessionModeLive !== 'voting') return
    setSoloSesionVerificacion(false)
    void cargarPreguntasRef.current(unidades)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transición única verification → voting
  }, [step, soloSesionVerificacion, sessionModeLive, asamblea?.asamblea_id, unidades])

  // Función auxiliar: refresca verificación general de asistencia + si este votante ya verificó en la sesión actual
  const refrescarVerificacion = async (asambleaId: string, emailVotante?: string) => {
    const aplicarDesdeApi = (json: {
      asamblea: {
        verificacion_asistencia_activa?: boolean
        verificacion_pregunta_id?: string | null
        participacion_timer_end_at?: string | null
        participacion_timer_default_minutes?: number | null
        participacion_timer_enabled?: boolean | null
        session_mode?: 'inactive' | 'verification' | 'voting'
        session_seq?: number
      }
      vData?: StatsVerif[] | null
      yaVerificoRaw?: boolean | null
    }) => {
      const aData = json.asamblea
      setParticipationTimerEndAt(aData.participacion_timer_end_at ?? null)
      setParticipationTimerDefaultMinutes(Number(aData.participacion_timer_default_minutes ?? 5) || 5)
      setParticipationTimerEnabled(aData.participacion_timer_enabled ?? true)
      if (aData.session_mode === 'inactive' || aData.session_mode === 'verification' || aData.session_mode === 'voting') {
        setSessionModeLive(aData.session_mode)
        setAsamblea((prev) =>
          prev
            ? {
                ...prev,
                session_mode: aData.session_mode,
                session_seq: aData.session_seq ?? prev.session_seq,
              }
            : prev
        )
      }

      const activa = !!aData.verificacion_asistencia_activa
      const prevActiva = verificacionActivaRef.current

      setVerificacionActiva(activa)
      if (!primeraLecturaVerificacionRef.current && activa && !prevActiva) setYaVerifico(false)
      primeraLecturaVerificacionRef.current = false
      prevVerificacionActivaRef.current = activa
      verificacionActivaRef.current = activa

      const vData = json.vData
      if (vData?.length) {
        const v = vData[0]
        setStatsVerificacion({
          total_verificados: Number(v.total_verificados) || 0,
          coeficiente_verificado: Number(v.coeficiente_verificado) || 0,
          porcentaje_verificado: Number(v.porcentaje_verificado) || 0,
          quorum_alcanzado: !!v.quorum_alcanzado,
        })
      } else {
        setStatsVerificacion(null)
      }

      const yaVerificoB = json.yaVerificoRaw === true
      if (emailVotante) {
        // Reflejar siempre el estado real del backend para evitar desincronización entre dispositivos/pestañas.
        setYaVerifico(!!yaVerificoB)
      }
    }

    try {
      const res = await fetch('/api/votar/estado-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          email: emailVotante?.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (res.ok && json.ok && json.asamblea) {
        aplicarDesdeApi(json as {
          asamblea: {
            verificacion_asistencia_activa?: boolean
            verificacion_pregunta_id?: string | null
            participacion_timer_end_at?: string | null
            participacion_timer_default_minutes?: number | null
            participacion_timer_enabled?: boolean | null
          }
          vData?: StatsVerif[] | null
          yaVerificoRaw?: boolean | null
        })
        return
      }

      const { data: aData } = await supabase
        .from('asambleas')
        .select('verificacion_asistencia_activa, verificacion_pregunta_id')
        .eq('id', asambleaId)
        .single()

      if (aData) {
        const activa = !!(aData as any).verificacion_asistencia_activa
        const prevActiva = verificacionActivaRef.current

        setVerificacionActiva(activa)
        if (!primeraLecturaVerificacionRef.current && activa && !prevActiva) setYaVerifico(false)
        primeraLecturaVerificacionRef.current = false
        prevVerificacionActivaRef.current = activa
        verificacionActivaRef.current = activa

        let vData: { total_verificados?: number; coeficiente_verificado?: number; porcentaje_verificado?: number; quorum_alcanzado?: boolean }[] | null = null
        if (activa) {
          const vRes = await supabase.rpc('calcular_verificacion_quorum', {
            p_asamblea_id: asambleaId,
            p_pregunta_id: null,
            p_solo_sesion_actual: true,
          })
          vData = vRes.data
        } else {
          const { data: ultimaSesion } = await supabase
            .from('verificacion_asamblea_sesiones')
            .select('total_verificados, coeficiente_verificado, porcentaje_verificado, quorum_alcanzado')
            .eq('asamblea_id', asambleaId)
            .is('pregunta_id', null)
            .not('cierre_at', 'is', null)
            .order('cierre_at', { ascending: false })
            .limit(1)
          if (ultimaSesion?.length) {
            vData = [{
              total_verificados: Number(ultimaSesion[0].total_verificados) ?? 0,
              coeficiente_verificado: Number(ultimaSesion[0].coeficiente_verificado) ?? 0,
              porcentaje_verificado: Number(ultimaSesion[0].porcentaje_verificado) ?? 0,
              quorum_alcanzado: !!ultimaSesion[0].quorum_alcanzado,
            }]
          }
        }
        const yaRes = emailVotante?.trim()
          ? await supabase.rpc('ya_verifico_asistencia', {
              p_asamblea_id: asambleaId,
              p_email: emailVotante.trim(),
              p_pregunta_id: null,
            })
          : { data: null }

        if (vData?.length) {
          const v = vData[0]
          setStatsVerificacion({
            total_verificados: Number(v.total_verificados) || 0,
            coeficiente_verificado: Number(v.coeficiente_verificado) || 0,
            porcentaje_verificado: Number(v.porcentaje_verificado) || 0,
            quorum_alcanzado: !!v.quorum_alcanzado,
          })
        } else {
          setStatsVerificacion(null)
        }

        const yaVerificoVal = yaRes.data
        const yaVerificoB = Array.isArray(yaVerificoVal)
          ? (yaVerificoVal as unknown[])[0] === true
          : yaVerificoVal === true
        if (emailVotante) {
          // Reflejar siempre el estado real del backend para evitar desincronización entre dispositivos/pestañas.
          setYaVerifico(!!yaVerificoB)
        }
      }
    } catch {
      // ignorar errores silenciosos de polling
    }
  }

  // Polling principal pesado: preguntas/votos/historial con menor frecuencia para proteger móvil/red.
  useEffect(() => {
    const enPantallaVotacion = step === 'consentimiento' || step === 'votar'
    if (!enPantallaVotacion || !asamblea || !email.trim()) return

    // Carga inicial de verificación (incluye email para saber si ya verificó)
    refrescarVerificacion(asamblea.asamblea_id, email.trim())

    const interval = setInterval(async () => {
      if (pollingPesadoInFlightRef.current) return
      pollingPesadoInFlightRef.current = true
      try {
        const s = stepRef.current
        // consentimiento + votar: lista de abiertas debe actualizarse (admin cierra/borra sin recargar la página).
        if (s === 'consentimiento' || s === 'votar') {
          if (s === 'votar') {
            let nuevasUnidades: UnidadInfo[] | undefined
            try {
              nuevasUnidades = await refrescarUnidades()
            } catch {
              nuevasUnidades = undefined
            }
            await cargarPreguntas(nuevasUnidades && nuevasUnidades.length > 0 ? nuevasUnidades : undefined)
            const u = nuevasUnidades && nuevasUnidades.length > 0 ? nuevasUnidades : undefined
            if (u && u.length > 0) await cargarHistorial(u)
          } else {
            await cargarPreguntas()
          }
        }
      } catch {
        // Ignorar errores de red o validación en background
      } finally {
        // Siempre actualizar verificación (verificacionActiva, yaVerifico) aunque falle el bloque anterior
        await refrescarVerificacion(asamblea.asamblea_id, email.trim())
        ultimaRecargaPesadaRef.current = Date.now()
        pollingPesadoInFlightRef.current = false
      }
    }, POLL_MS_HEAVY)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling when step or asamblea changes
  }, [step, asamblea?.asamblea_id, email])

  // Al volver a la pestaña o al foco: iOS/Safari pausan setInterval en segundo plano; recargar preguntas al instante
  useEffect(() => {
    const enPantallaVotacion = step === 'consentimiento' || step === 'votar'
    if (!enPantallaVotacion || !asamblea || !email.trim()) return

    const recargarSiVotando = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (pollingPesadoInFlightRef.current) return
      if (shouldSkipFocusRefresh(ultimaRecargaPesadaRef.current, Date.now())) return
      pollingPesadoInFlightRef.current = true
      try {
        await refrescarVerificacion(asamblea.asamblea_id, email.trim())
        const s = stepRef.current
        if (s !== 'votar' && s !== 'consentimiento') return
        if (s === 'consentimiento') {
          await cargarPreguntas()
          return
        }
        let nuevasUnidades: UnidadInfo[] | undefined
        try {
          nuevasUnidades = await refrescarUnidades()
        } catch {
          nuevasUnidades = undefined
        }
        await cargarPreguntas(nuevasUnidades && nuevasUnidades.length > 0 ? nuevasUnidades : undefined)
        if (nuevasUnidades && nuevasUnidades.length > 0) await cargarHistorial(nuevasUnidades)
      } catch {
        // ignorar
      } finally {
        ultimaRecargaPesadaRef.current = Date.now()
        pollingPesadoInFlightRef.current = false
      }
    }

    const onVisibility = () => {
      void recargarSiVotando()
    }
    const onFocus = () => {
      void recargarSiVotando()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void recargarSiVotando()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, asamblea?.asamblea_id, email])

  // Cargar historial al cambiar al tab de avance; refrescar verificación general para ver el avance en vivo
  useEffect(() => {
    if (tabActivo === 'avance' && step === 'votar' && unidades.length > 0 && preguntasCerradas.length === 0) {
      cargarHistorial(unidades)
    }
    if (tabActivo === 'avance' && step === 'votar' && asamblea?.asamblea_id && verificacionActiva) {
      void refrescarVerificacion(asamblea.asamblea_id, email?.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActivo])

  const handleVerificarAsistencia = async () => {
    if (!asamblea || verificando) return
    setVerificando(true)
    try {
      const res = await fetch('/api/verificar-asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asamblea_id: asamblea.asamblea_id, email: email.trim() }),
      })
      if (res.ok) {
        setYaVerifico(true)
        toast.success('¡Asistencia verificada! Tu presencia quedó registrada.')
        await refrescarVerificacion(asamblea.asamblea_id, email.trim())
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'No se pudo registrar la verificación.')
      }
    } catch {
      toast.error('Error de conexión al verificar asistencia.')
    } finally {
      setVerificando(false)
    }
  }

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha + 'T00:00:00')
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (step === 'validando') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Validando código de acceso...</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full min-w-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 border border-red-200 dark:border-red-800">
          <div className="text-center min-w-0">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Acceso Denegado
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 break-words">
              {error}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="font-semibold mb-1">Posibles razones:</p>
              <ul className="text-left space-y-1">
                <li>• El administrador <strong>desactivó el acceso público</strong> a la votación (no es lo mismo que cerrar una pregunta)</li>
                <li>• Tras mucho tiempo en segundo plano el móvil puede <strong>recargar la página</strong>; si el acceso se desactivó mientras tanto, verás este mensaje</li>
                <li>• El código es incorrecto o el enlace está incompleto</li>
                <li>
                  • Si en el mismo dispositivo tienes abierta la <strong>cuenta de administración</strong> de otra copropiedad, prueba en <strong>ventana de incógnito</strong> o otro navegador
                </li>
                <li>
                  • En celular: abre el enlace en <strong>Chrome o Safari</strong> (no en el navegador interno de WhatsApp u otras apps); algunos lectores de QR alteran el código
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full min-w-0 bg-surface dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 border border-border dark:border-gray-700">
          {participationTimerEnabled && (
            <div className="mt-3 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium bg-slate-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200">
                <Clock className="w-3.5 h-3.5" />
                {formatMMSS(participationTimerSecondsLeft)}
              </span>
            </div>
          )}
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 min-w-0">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-primary to-purple-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <Vote className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Votación Virtual
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Código: <span className="font-mono font-bold text-primary dark:text-indigo-400">{codigo}</span>
            </p>
          </div>

          {/* Información de la Asamblea */}
          {asamblea && (
            <div className="bg-gradient-to-r from-primary-light to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6 border border-border dark:border-indigo-800">
              {sessionModeLive === 'inactive' && (
                <Alert className="mb-3 border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 dark:text-amber-100 text-sm">
                    El administrador aún no ha iniciado la sesión de verificación o votación. Esta página se actualizará sola cuando esté lista.
                  </AlertDescription>
                </Alert>
              )}
              <h2 className="font-bold text-gray-900 dark:text-white mb-2">
                {asamblea.nombre}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                🏢 {asamblea.nombre_conjunto}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                📅 {formatFecha(asamblea.fecha)}
              </p>
            </div>
          )}

          {/* Formulario: Email o Teléfono */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email, teléfono o identificación registrada
              </label>
              <Input
                type="text"
                inputMode="email"
                autoComplete="email tel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com, 3001234567 o 1234567890"
                className="w-full text-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleValidarEmail()}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ℹ️ Ingresa el email, teléfono o número de identificación registrado en tu unidad o en tu poder (si eres tercero)
              </p>
            </div>

            {error && (
              <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleValidarEmail}
              disabled={loading || !email.trim()}
              className="w-full min-w-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-sm sm:text-lg py-4 sm:py-6"
              title="Continuar para ver tus unidades y votar"
            >
              {loading ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Verificando...
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              🔒 Solo podrás votar si tu email, teléfono o identificación está registrado en una unidad o en un poder activo.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'consentimiento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-x-hidden">
        {/* Sin aceptar el EULA no se puede verificar quórum: el popup de verificación solo aparece en step 'votar' */}
        <div className="max-w-md w-full min-w-0 bg-surface dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 border border-border dark:border-gray-700">
          {participationTimerEnabled && (
            <div className="mt-3 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium bg-slate-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200">
                <Clock className="w-3.5 h-3.5" />
                {formatMMSS(participationTimerSecondsLeft)}
              </span>
            </div>
          )}
          <div className="text-center mb-4 sm:mb-6">
            <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-primary to-purple-600 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <Vote className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              Tratamiento de datos personales
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Para participar en la votación debe aceptar el tratamiento de sus datos según la ley.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-700 text-left text-xs sm:text-sm text-gray-700 dark:text-gray-300 max-h-40 sm:max-h-48 overflow-y-auto min-w-0">
            <p className="font-semibold mb-2">Ley 1581 de 2012 (Colombia) — Protección de datos personales</p>
            <p className="mb-2">
              Al continuar, usted acepta que sus datos personales (correo electrónico o teléfono, votos emitidos y actividad en la plataforma) sean tratados por <strong>Votaciones de Asambleas Online</strong> y por el administrador del conjunto únicamente para:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-2">
              <li>Gestionar su participación en esta votación</li>
              <li>Generar el acta y la auditoría de la asamblea</li>
              <li>Cumplir con las obligaciones legales aplicables</li>
            </ul>
            <p>
              Puede ejercer sus derechos de acceso, corrección y supresión de sus datos contactando al administrador de su conjunto o a través de los canales indicados en la plataforma.
            </p>
          </div>
          <p className="text-xs text-center text-gray-600 dark:text-gray-400 mb-4">
            Si lo deseas, puedes{' '}
            <a
              href="/EULA-Asambleas-App.txt"
              download
              className="underline underline-offset-2 hover:text-gray-900 dark:hover:text-gray-200"
            >
              descargar el EULA
            </a>{' '}
            antes de continuar.
          </p>

          <label className="flex items-start gap-3 cursor-pointer mb-4 sm:mb-6 min-w-0">
            <input
              type="checkbox"
              checked={consentimientoAceptado}
              onChange={(e) => setConsentimientoAceptado(e.target.checked)}
              className="mt-1 shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
            />
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 min-w-0 break-words">
              Acepto el tratamiento de mis datos personales conforme a lo indicado anteriormente y según la Ley 1581 de 2012.
            </span>
          </label>

          {error && (
            <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200 break-words">{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleAceptarConsentimiento}
            disabled={!consentimientoAceptado || guardandoConsentimiento}
            className="w-full min-w-0 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-sm sm:text-lg py-4 sm:py-6 px-4"
          >
            {guardandoConsentimiento ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2 shrink-0"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Aceptar y continuar a la votación</span>
                <span className="sm:hidden">Aceptar y continuar</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 shrink-0" />
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-3 min-w-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm sm:text-base py-4"
            onClick={() => setStep('rechazo_consentimiento')}
            disabled={guardandoConsentimiento}
          >
            No acepto — salir
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'rechazo_consentimiento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full min-w-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center min-w-0 space-y-6">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
              <span className="text-3xl sm:text-4xl" aria-hidden>🙏</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                ¡Gracias por usar nuestra aplicación!
              </h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">
                Valoramos que hayas visitado nuestra plataforma de votaciones en línea para asambleas.
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 text-left">
              <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                <strong>Sin aceptar el tratamiento de tus datos personales</strong> no es posible participar en la votación en línea. Esto es requerido por la Ley 1581 de 2012 (Colombia) para proteger tu información.
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-2 break-words">
                Si cambias de opinión, puedes volver atrás y aceptar para continuar con tu voto.
              </p>
            </div>
            <div>
              <Button
                onClick={() => setStep('consentimiento')}
                className="w-full min-w-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-base"
              >
                Volver atrás
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'votar') {
    const totalCoeficiente = unidades.reduce((sum, u) => sum + u.coeficiente, 0)
    const unidadesPropias = unidades.filter(u => !u.es_poder)
    const unidadesPoderes = unidades.filter(u => u.es_poder)
    const idsYaRepresentados = new Set(unidades.map((u) => u.id))
    const opcionesOtorgantesPoder = unidadesDelegacionOpciones.filter((u) => !idsYaRepresentados.has(u.id))
    const todasVotadas =
      preguntas.length > 0 &&
      preguntas.every((p) =>
        unidades.every((u) => votosActuales.some((v) => v.pregunta_id === p.id && v.unidad_id === u.id))
      )

    const pctColor = (pct: number) =>
      pct > 50 ? 'text-green-600 dark:text-green-400' :
      pct >= 30 ? 'text-amber-600 dark:text-amber-400' :
      'text-red-600 dark:text-red-400'

    const pctBg = (pct: number) =>
      pct > 50 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
      pct >= 30 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
      'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'

    const QuorumChip = ({ pct, total, small }: { pct: number; total: number; small?: boolean }) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${pctBg(pct)}`}>
        <UserCheck className={`${small ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0 ${pctColor(pct)}`} />
        <span className={pctColor(pct)}>{pct.toFixed(1)}%</span>
        {!small && <span className="text-gray-500 dark:text-gray-400">({total} verif.)</span>}
      </span>
    )

    const TABS = [
      { id: 'votacion' as const, label: 'Votación', short: 'Votar' },
      { id: 'avance' as const, label: 'Avance', short: 'Avance' },
      { id: 'poderes' as const, label: 'Poderes', short: 'Poderes' },
      { id: 'misdatos' as const, label: 'Perfil', short: 'Perfil' },
    ]

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800">
        {/* Popup de Verificación de Quórum */}
        <Dialog open={verificacionActiva && !yaVerifico} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm rounded-2xl" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Verificación de Asistencia
              </DialogTitle>
              <DialogDescription>
                El administrador solicita confirmar tu asistencia en esta ronda. Pulsa el botón para registrar que estás presente; tu confirmación quedará registrada en el acta. La pantalla permanecerá bloqueada hasta que verifiques o el administrador cierre la verificación.
              </DialogDescription>
            </DialogHeader>
            {statsVerificacion && statsVerificacion.total_verificados > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-indigo-700 dark:text-indigo-300">
                  {statsVerificacion.total_verificados} unidades ya confirmaron ({statsVerificacion.porcentaje_verificado.toFixed(1)}%)
                </span>
              </div>
            )}
            <div className="pt-2">
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleVerificarAsistencia}
                disabled={verificando}
              >
                {verificando ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Registrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    Verifiqué Asistencia
                  </span>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de ayuda al votante */}
        <Dialog open={showAyudaVotar} onOpenChange={setShowAyudaVotar}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Ayuda: cómo votar
              </DialogTitle>
              <DialogDescription>
                Guía rápida para participar en la votación en línea. La lista de preguntas puede actualizarse en vivo cuando el administrador abre o cierra preguntas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Pasos de la votación</h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                  <li><strong>Código de acceso</strong> — El enlace o QR que te enviaron ya incluye el código.</li>
                  <li><strong>Email o teléfono</strong> — Ingresa el que está registrado en tu unidad o con el que tienes poderes.</li>
                  <li><strong>Consentimiento</strong> — Acepta el tratamiento de datos (Ley 1581) para continuar.</li>
                  <li><strong>Votar</strong> — En cada pregunta elige una opción por cada una de tus unidades (propias y poderes).</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Tipos de votación</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Por coeficiente:</strong> el peso de tu voto es el % de copropiedad de tu unidad (Ley 675). <strong>Nominal:</strong> cada unidad cuenta como un voto. Los resultados se muestran según el tipo definido por el administrador.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Poderes</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Si te otorgaron un poder, verás esas unidades junto con las tuyas en la votación. Para declarar un poder nuevo o ver solicitudes en verificación, usa la pestaña <strong>Poderes</strong>.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Verificación de asistencia</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Si el administrador activó la verificación de quórum, aparecerá un aviso para que confirmes tu asistencia. Es necesario hacerlo para que tu presencia quede registrada en el acta.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Actualización de la votación</h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Si el administrador abre o cierra preguntas mientras votas, la pantalla puede refrescarse sola para mostrar los cambios. Si no ves una pregunta nueva, usa el botón de actualizar de tu navegador o vuelve a entrar al enlace.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Menú hamburguesa (móvil): ayuda y cierre de sesión del votante */}
        <Dialog open={showVotanteMenu} onOpenChange={setShowVotanteMenu}>
          <DialogContent className="max-w-xs rounded-2xl">
            <DialogHeader>
              <DialogTitle>Menú</DialogTitle>
              <DialogDescription>
                Opciones de tu sesión de votación.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowVotanteMenu(false)
                  setShowAyudaVotar(true)
                }}
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Ver ayuda
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleCerrarSesionVotante}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header fijo con indicador de quórum */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{asamblea?.nombre_conjunto}</p>
                <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">{asamblea?.nombre}</h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowVotanteMenu(true)}
                  className="sm:hidden p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
                  title="Menú"
                  aria-label="Abrir menú"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAyudaVotar(true)}
                  className="hidden sm:inline-flex p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
                  title="Ayuda"
                  aria-label="Ver ayuda"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
                {participationTimerEnabled && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                      participationTimerEnded
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                        : 'bg-slate-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {formatMMSS(participationTimerSecondsLeft)}
                  </span>
                )}
                {statsVerificacion && (
                  <QuorumChip pct={statsVerificacion.porcentaje_verificado} total={statsVerificacion.total_verificados} />
                )}
                {(verificacionActiva || !!statsVerificacion) && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                      yaVerifico
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}
                    title={yaVerifico ? 'Tu asistencia quedó verificada en la última validación.' : 'Tu asistencia no quedó verificada en la última validación.'}
                  >
                    {yaVerifico ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {yaVerifico ? 'Asistencia verificada' : 'Asistencia pendiente'}
                  </span>
                )}
              </div>
            </div>
            {/* Tabs: min-w-0 y overflow-hidden para que no desborden en móvil */}
            <div className="flex w-full min-w-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabActivo(tab.id)}
                  className={`flex-1 min-w-0 py-2 px-1 text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 overflow-hidden flex items-center justify-center gap-1 ${
                    tabActivo === tab.id
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm'
                      : 'text-gray-800 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                  <span className="sm:hidden truncate">{tab.short}</span>
                  {tab.id === 'votacion' && preguntas.length > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold shrink-0">{preguntas.length}</span>
                  )}
                  {tab.id === 'avance' && todasVotadas && (
                    <span className="text-green-500 shrink-0">✓</span>
                  )}
                  {tab.id === 'poderes' && misPoderesPendientes.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold shrink-0">
                      {misPoderesPendientes.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 pb-10">

          {/* ── TAB 1: VOTACIÓN ── */}
          {tabActivo === 'votacion' && (
            <div className="space-y-4">
              {soloSesionVerificacion && !todasVotadas && (
                <Alert className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40">
                  <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <AlertDescription className="text-indigo-900 dark:text-indigo-100 text-sm">
                    Has aceptado el tratamiento de datos. El administrador aún no ha abierto la <strong>votación</strong>: cuando lo haga, las preguntas aparecerán aquí automáticamente. Puedes dejar esta página abierta.
                  </AlertDescription>
                </Alert>
              )}
              {/* Banner de éxito cuando terminó de votar */}
              {todasVotadas && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-2 border-emerald-300 dark:border-emerald-700 text-center">
                  <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    ¡Gracias! Tu participación quedó registrada
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Has votado con todas tus unidades en las preguntas abiertas.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTabActivo('avance')}
                    className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
                  >
                    Ver avance de la votación →
                  </button>
                </div>
              )}

          {/* Tarjetas de votación */}
          <div className="space-y-4">
            {preguntas.length === 0 ? (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 text-center">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    No hay preguntas abiertas
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    En este momento no hay preguntas disponibles para votar. El administrador abrirá las preguntas cuando inicie la votación.
                  </p>
                </div>
                {/* Cuando tampoco hay verificación de asistencia activa, mostrar QR para compartir acceso con quienes no han ingresado */}
                {!verificacionActiva && urlVotacionCompartir && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-3">
                          <QrCode className="w-5 h-5" aria-hidden />
                          <span className="text-sm font-semibold">Comparte el acceso</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3 max-w-[220px]">
                          Quienes ya están dentro pueden mostrar este QR para que otros ingresen a la votación.
                        </p>
                        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-inner border border-gray-100 dark:border-gray-700 w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] flex items-center justify-center" role="img" aria-label="Código QR de acceso a la página de votación">
                          <QRCodeSVG value={urlVotacionCompartir} size={200} level="H" includeMargin style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }} />
                        </div>
                      </div>
                      <div className="flex-1 w-full sm:w-auto flex flex-col items-center sm:items-start gap-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                          O copia el enlace y compártelo por WhatsApp, correo o mensaje:
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
                          <input
                            type="text"
                            readOnly
                            value={urlVotacionCompartir}
                            className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-300 truncate"
                            aria-label="Enlace de votación"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (copiandoEnlace) return
                              setCopiandoEnlace(true)
                              try {
                                await navigator.clipboard.writeText(urlVotacionCompartir)
                                toast.success('Enlace copiado. Compártelo con quien necesite ingresar.')
                              } catch {
                                toast.error('No se pudo copiar. Copia el enlace manualmente.')
                              } finally {
                                setCopiandoEnlace(false)
                              }
                            }}
                            disabled={copiandoEnlace}
                            className="shrink-0 inline-flex items-center gap-2 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          >
                            <Copy className="w-4 h-4" />
                            {copiandoEnlace ? 'Copiado…' : 'Copiar enlace'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              preguntas.map((pregunta, index) => {
                const votoActual = votosActuales.find(v => v.pregunta_id === pregunta.id)
                const stats = estadisticas[pregunta.id]

                return (
                  <div key={pregunta.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Header de la Pregunta */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                              Pregunta {index + 1}
                            </span>
                            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                              ABIERTA
                            </span>
                            {statsVerificacion && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-medium">
                                <UserCheck className="w-3 h-3 shrink-0" />
                                {statsVerificacion.porcentaje_verificado.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-1 break-words">
                            {pregunta.texto_pregunta}
                          </h3>
                          {pregunta.descripcion && (
                            <p className="text-white/80 text-sm">
                              {pregunta.descripcion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Resumen de votación */}
                      {(() => {
                        const votosDeEstaPregunta = votosActuales.filter(v => v.pregunta_id === pregunta.id)
                        const unidadesVotadas = votosDeEstaPregunta.length
                        const totalUnidades = unidades.length
                        const porcentajeCompletado = totalUnidades > 0 ? (unidadesVotadas / totalUnidades) * 100 : 0

                        return unidadesVotadas > 0 && (
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                Tu progreso de votación
                              </p>
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {unidadesVotadas}/{totalUnidades} unidades
                              </span>
                            </div>
                            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                              <div 
                                className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${porcentajeCompletado}%` }}
                              />
                            </div>
                            {unidadesVotadas === totalUnidades && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                ¡Has votado con todas tus unidades!
                              </p>
                            )}
                          </div>
                        )
                      })()}

                      {/* Votar por cada unidad */}
                      <div className="space-y-6 mb-6">
                        {unidades.map((unidad) => {
                          const votoUnidad = votosActuales.find(v => v.pregunta_id === pregunta.id && v.unidad_id === unidad.id)
                          
                          return (
                            <div key={unidad.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-900">
                              {/* Header de la unidad: responsive para que "Votado" y opción no desborden */}
                              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-gray-900 dark:text-white truncate">
                                    {unidad.torre} - {unidad.numero}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    Coeficiente: {unidad.coeficiente.toFixed(6)}%
                                    {unidad.es_poder && (
                                      <span className="ml-2 text-purple-600 dark:text-purple-400">• Poder</span>
                                    )}
                                  </p>
                                </div>
                                {votoUnidad && (
                                  <div className="shrink-0 flex flex-col items-end gap-0.5 text-right min-w-0 max-w-full">
                                    <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full whitespace-nowrap">
                                      ✓ Votado
                                    </span>
                                    <p className="text-xs text-green-600 dark:text-green-400 break-words line-clamp-2">
                                      {votoUnidad.opcion_texto}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Opciones de votación para esta unidad */}
                              <div className="space-y-2">
                                {pregunta.opciones.map((opcion) => {
                                  const esVotoActual = votoUnidad?.opcion_id === opcion.id
                                  const stats_opcion = stats?.resultados?.find(r => r.opcion_id === opcion.id)
                                  const tipoVotBtn = stats?.tipo_votacion ?? pregunta.tipo_votacion ?? 'coeficiente'
                                  const porcentajeTotal = stats_opcion ? pctRelevante(stats_opcion, tipoVotBtn) : 0
                                  const porcentajeEmitidos = stats_opcion?.porcentaje_coeficiente_emitido ?? stats_opcion?.porcentaje_coeficiente ?? 0

                                  return (
                                    <button
                                      key={opcion.id}
                                      onClick={() => handleVotar(pregunta.id, unidad.id, opcion.id)}
                                      disabled={votando === pregunta.id}
                                      aria-pressed={esVotoActual}
                                      className={`
                                        w-full min-w-0 text-left p-3.5 rounded-xl border-2 transition-all relative
                                        ${esVotoActual 
                                          ? 'border-green-500 bg-green-100 dark:bg-green-900/40 ring-2 ring-inset ring-green-400/80 dark:ring-green-600/80 shadow-sm' 
                                          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-gray-800'
                                        }
                                        ${votando === pregunta.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                      `}
                                    >
                                      <div className="flex items-start gap-2 min-w-0 w-full">
                                        <div 
                                          className="w-3 h-3 rounded-full border-2 shrink-0 mt-0.5"
                                          style={{ 
                                            backgroundColor: esVotoActual ? opcion.color : 'transparent',
                                            borderColor: opcion.color 
                                          }}
                                        />
                                        <div className="min-w-0 flex-1 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                          <span className="text-sm font-medium text-gray-900 dark:text-white break-words text-left">
                                            {opcion.texto}
                                          </span>
                                          {esVotoActual && (
                                            <span className="text-[11px] sm:text-xs bg-green-700 text-white px-2 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0 self-start sm:self-center">
                                              ✓ Seleccionada
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

            </div>
          )}

          {/* ── TAB 2: AVANCE ── */}
          {tabActivo === 'avance' && (
            <div className="space-y-4">
              {/* Chip de quórum verificado global */}
              {(verificacionActiva || statsVerificacion) && (
                <div className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                  statsVerificacion?.quorum_alcanzado
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : (statsVerificacion?.porcentaje_verificado ?? 0) >= 30
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <UserCheck className={`w-4 h-4 shrink-0 ${statsVerificacion ? pctColor(statsVerificacion.porcentaje_verificado) : 'text-slate-400'}`} />
                  {statsVerificacion ? (
                    <>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        Asistencia general: <span className={`font-bold ${pctColor(statsVerificacion.porcentaje_verificado)}`}>{statsVerificacion.porcentaje_verificado.toFixed(1)}%</span>
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({statsVerificacion.total_verificados} unidades · coef. {statsVerificacion.coeficiente_verificado.toFixed(4)}%)
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        statsVerificacion.quorum_alcanzado
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      }`}>
                        {statsVerificacion.quorum_alcanzado ? '✓ Quórum Ley 675 Art. 45' : '✗ Sin quórum (>50%)'}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600 dark:text-gray-300">Cargando avance de verificación de asistencia…</span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Umbral de aprobación: {UMBRAL_APROBACION_DEFECTO}% (mayoría simple). Se actualiza automáticamente.
                </p>
                <Button
                  onClick={refrescarDatos}
                  disabled={recargando}
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                >
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${recargando ? 'animate-spin' : ''}`} />
                  {recargando ? 'Actualizando…' : 'Actualizar'}
                </Button>
              </div>

              {/* Preguntas abiertas */}
              {preguntas.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
                    Preguntas abiertas
                  </h3>
                  {preguntas.map((pregunta, index) => {
                    const stats = estadisticas[pregunta.id]
                    if (!stats) {
                      return (
                        <div key={pregunta.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm px-4 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            P{index + 1}: {pregunta.texto_pregunta}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cargando resultados de votación…</p>
                        </div>
                      )
                    }
                    const tipoVot = stats.tipo_votacion ?? pregunta.tipo_votacion ?? 'coeficiente'
                    const participacion = stats.porcentaje_participacion ?? 0
                    const pendienteParticipacion = Math.max(0, 100 - participacion)
                    const tuPub = totalUnidadesConjunto
                    const tvPub = stats.total_votos ?? 0
                    const sinVotarPub = tuPub != null ? Math.max(0, tuPub - tvPub) : null
                    const umbral = pregunta.umbral_aprobacion ?? UMBRAL_APROBACION_DEFECTO
                    const resultados = stats.resultados ?? []
                    const maxPct = resultados.length > 0
                      ? Math.max(...resultados.map((r: { porcentaje_coeficiente_total?: number; porcentaje_coeficiente?: number; porcentaje_nominal_total?: number; porcentaje_votos_emitidos?: number }) =>
                          pctRelevante(r, tipoVot)))
                      : 0
                    const algunaAprobada = maxPct >= umbral
                    return (
                      <div key={pregunta.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[65%]">
                            P{index + 1}: {pregunta.texto_pregunta}
                          </h4>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${algunaAprobada ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                              {algunaAprobada ? '✓ Aprobada' : '○ Pendiente'}
                            </span>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1 gap-2">
                              <span className="text-gray-600 dark:text-gray-400">
                                {tipoVot === 'coeficiente'
                                  ? 'Participación (coeficiente del conjunto)'
                                  : 'Participación (unidades del conjunto)'}
                              </span>
                              <span className="font-medium text-gray-800 dark:text-gray-200 text-right">
                                {tipoVot === 'coeficiente' ? (
                                  <>
                                    {tuPub != null ? (
                                      <>
                                        <span className="tabular-nums">{tvPub}</span>/
                                        <span className="tabular-nums">{tuPub}</span> en esta pregunta
                                        {sinVotarPub != null && sinVotarPub > 0 && (
                                          <>
                                            {' '}
                                            · <span className="tabular-nums">{sinVotarPub}</span> sin votar
                                          </>
                                        )}
                                        {' · '}
                                      </>
                                    ) : (
                                      <>
                                        {tvPub} {(tvPub === 1 ? 'unidad' : 'unidades')} ·{' '}
                                      </>
                                    )}
                                    {participacion.toFixed(2)}% coef. emitido · {pendienteParticipacion.toFixed(2)}% pendiente
                                    (del conjunto)
                                  </>
                                ) : (
                                  <>
                                    {tuPub != null ? (
                                      <>
                                        <span className="tabular-nums">{tvPub}</span>/
                                        <span className="tabular-nums">{tuPub}</span> en esta pregunta
                                        {sinVotarPub != null && sinVotarPub > 0 && (
                                          <>
                                            {' '}
                                            · <span className="tabular-nums">{sinVotarPub}</span> sin votar
                                          </>
                                        )}
                                        {' · '}
                                      </>
                                    ) : (
                                      <>
                                        {tvPub} {(tvPub === 1 ? 'unidad' : 'unidades')} ·{' '}
                                      </>
                                    )}
                                    {participacion.toFixed(2)}% · {pendienteParticipacion.toFixed(2)}% pendiente
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(participacion, 100)}%` }} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            {resultados.map((r: { opcion_id?: string; opcion_texto?: string; color?: string; votos_cantidad?: number; votos_coeficiente?: number; porcentaje_coeficiente_total?: number; porcentaje_coeficiente?: number; porcentaje_nominal_total?: number; porcentaje_votos_emitidos?: number }, ri: number) => {
                              const pct = pctRelevante(r, tipoVot)
                              const pasaUmbral = pct >= umbral
                              const nUnid = r.votos_cantidad ?? 0
                              return (
                                <div key={r.opcion_id ?? `opt-${index}-${ri}`} className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color || '#6366f1' }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between gap-2 text-xs mb-0.5">
                                      <span className="text-gray-700 dark:text-gray-300 truncate">{r.opcion_texto ?? '—'}</span>
                                      <span className={`font-medium shrink-0 text-right ${pasaUmbral ? 'text-green-600 dark:text-green-400' : ''}`}>
                                        <span className="tabular-nums">{pct.toFixed(2)}%{pasaUmbral ? ' ✓' : ''}</span>
                                      </span>
                                    </div>
                                    <div className="flex justify-end text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                      {nUnid} {nUnid === 1 ? 'unidad' : 'unidades'}
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden relative">
                                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: r.color || '#6366f1' }} />
                                      {pct < umbral && umbral <= 100 && (
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500" style={{ left: `${umbral}%` }} title={`Umbral ${umbral}%`} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {resultados.length > 0 && (() => {
                            const maxLocal = Math.max(...resultados.map((r) => pctRelevante(r, tipoVot)))
                            const aprobado = maxLocal >= umbral
                            return (
                              <div className={`py-1.5 px-3 rounded-lg text-center text-xs font-semibold ${aprobado ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                {aprobado ? '✓ Aprobado' : '○ Pendiente'} — máx. opción: {maxLocal.toFixed(2)}% (necesita ≥{umbral}%)
                              </div>
                            )
                          })()}
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            {tipoVot === 'nominal' ? 'Porcentajes sobre total de unidades (nominal)' : 'Porcentajes sobre coeficiente total del conjunto (Ley 675)'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Preguntas cerradas (historial) */}
              <div className="space-y-4 mt-2">
                {preguntasCerradas.length === 0 && preguntas.length === 0 && (
                  <div className="text-center py-10">
                    <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">El administrador abrirá las preguntas cuando inicie la votación.</p>
                  </div>
                )}
                {preguntasCerradas.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5 mt-2">
                      <History className="w-4 h-4 text-purple-500" />
                      Historial (cerradas)
                    </h3>
                    {preguntasCerradas.map((pregunta, index) => {
                      const stats = estadisticasCerradas[pregunta.id]
                      const misVotos = votosHistorico.filter(v => v.pregunta_id === pregunta.id)
                      return (
                        <div key={pregunta.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate max-w-[70%]">
                              P{index + 1}: {pregunta.texto_pregunta}
                            </h4>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">CERRADA</span>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            {misVotos.length > 0 && (
                              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Tus votos:
                                </p>
                                {misVotos.map((voto) => {
                                  const unidad = unidades.find(u => u.id === voto.unidad_id)
                                  return (
                                    <div key={`${voto.pregunta_id}-${voto.unidad_id}`} className="flex justify-between text-xs">
                                      <span className="text-gray-600 dark:text-gray-400">{unidad?.torre} - {unidad?.numero}:</span>
                                      <span className="font-semibold text-green-700 dark:text-green-400">{voto.opcion_texto}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {stats && stats.resultados && stats.resultados.length > 0 && (() => {
                              const tipoVotCerrada = stats.tipo_votacion ?? pregunta.tipo_votacion ?? 'coeficiente'
                              return (
                                <div className="space-y-2">
                                  {stats.resultados.map((resultado: any) => {
                                    const porcentaje = pctRelevante(resultado, tipoVotCerrada)
                                    return (
                                      <div key={resultado.opcion_id}>
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{resultado.opcion_texto}</span>
                                          <span className="text-xs font-bold text-gray-900 dark:text-white">{porcentaje.toFixed(2)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                          <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${Math.min(porcentaje, 100)}%`, backgroundColor: resultado.color || '#6366f1' }} />
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                          {(resultado.votos_cantidad || 0) === 1
                                            ? '1 unidad'
                                            : `${resultado.votos_cantidad || 0} unidades`}
                                        </p>
                                      </div>
                                    )
                                  })}
                                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                    {(() => {
                                      const tipoVotCerrada2 = stats.tipo_votacion ?? pregunta.tipo_votacion ?? 'coeficiente'
                                      const umbralEfectivo = pregunta.umbral_aprobacion ?? UMBRAL_APROBACION_DEFECTO
                                      const maxPct = Math.max(...stats.resultados.map((r: any) => pctRelevante(r, tipoVotCerrada2)))
                                      const aprobado = maxPct >= umbralEfectivo
                                      return (
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-gray-500 dark:text-gray-400">Umbral: {umbralEfectivo}%</span>
                                          <span className={`font-semibold ${aprobado ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            {aprobado ? '✓ Aprobado' : '○ No aprobado'} · líder: {maxPct.toFixed(2)}%
                                          </span>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: PODERES (delegación y solicitudes) ── */}
          {tabActivo === 'poderes' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  Poderes y delegación
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                  Aquí registras si otro apartamento te delegó el voto, o revisas el estado de tus solicitudes. La votación en sí sigue en la pestaña <strong>Votación</strong>.
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 leading-relaxed">
                  Los poderes se <strong>activan a discreción del administrador</strong> del conjunto. Solo se tendrán en cuenta las
                  solicitudes presentadas <strong>dentro del plazo</strong> que defina la administración; de forma habitual se solicita
                  entregar la documentación hasta <strong>24 horas antes</strong> de la asamblea.
                </p>
              </div>

              {unidades.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 p-4 shadow-sm space-y-3">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    Registrar poder que te otorgaron
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Si otro apartamento te delegó el voto, indícalo aquí. La solicitud{' '}
                    <strong>no activa el poder para votar</strong> hasta que un administrador lo verifique (documento o acta) en la tabla de poderes.
                  </p>
                  {cargandoDelegacion ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando unidades…
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="poder-otorgante" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Unidad que otorga el poder <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="poder-otorgante"
                          value={poderOtorganteId}
                          onChange={(e) => setPoderOtorganteId(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
                        >
                          <option value="">— Elige torre y apartamento —</option>
                          {opcionesOtorgantesPoder.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.torre || 'S/T'} — {u.numero || 'S/N'}
                            </option>
                          ))}
                        </select>
                        {opcionesOtorgantesPoder.length === 0 && (
                          <p className="text-xs text-indigo-700 dark:text-indigo-300">
                            No hay más unidades en el censo distintas a las tuyas, o aún se cargan los datos.
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="poder-nombre-receptor" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Tu nombre (apoderado) — opcional
                        </label>
                        <input
                          id="poder-nombre-receptor"
                          type="text"
                          value={nombreReceptorPoder}
                          onChange={(e) => setNombreReceptorPoder(e.target.value)}
                          placeholder="Como figura en el poder o documento"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="poder-obs" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Notas — opcional
                        </label>
                        <textarea
                          id="poder-obs"
                          value={observacionesPoder}
                          onChange={(e) => setObservacionesPoder(e.target.value)}
                          rows={2}
                          placeholder="Ej. referencia del documento"
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 resize-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Documento escaneado — opcional</span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-indigo-600 dark:text-indigo-400">
                          <Upload className="w-4 h-4" />
                          <span>{archivoPoderVotante ? archivoPoderVotante.name : 'Elegir PDF o Word (máx. 2 MB)'}</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="sr-only"
                            onChange={(e) => setArchivoPoderVotante(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void enviarDeclaracionPoder()}
                        disabled={enviandoPoderPendiente || !poderOtorganteId}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm shadow-sm"
                      >
                        {enviandoPoderPendiente ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Enviando…
                          </span>
                        ) : (
                          'Enviar solicitud'
                        )}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {unidades.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">Tus solicitudes pendientes</h3>
                    {cargandoMisPendientes && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  {misPoderesPendientes.length === 0 && !cargandoMisPendientes ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No tienes solicitudes en verificación.</p>
                  ) : (
                    <ul className="space-y-2">
                      {misPoderesPendientes.map((p) => (
                        <li
                          key={p.id}
                          className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-gray-800/80 p-2.5"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            {p.unidad_otorgante_torre} — {p.unidad_otorgante_numero}
                          </div>
                          <div className="text-gray-500 dark:text-gray-500 mt-1">
                            Coef. delegado: {Number(p.coeficiente_delegado || 0).toFixed(4)}% ·{' '}
                            {p.created_at
                              ? new Date(p.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
                              : ''}
                          </div>
                          {p.archivo_poder && (
                            <a
                              href={p.archivo_poder}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 mt-1 hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Ver documento cargado
                            </a>
                          )}
                          <p className="text-indigo-700 dark:text-indigo-300 mt-1.5 font-medium">En espera de verificación del administrador</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full sm:w-auto border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                            disabled={cancelandoPoderId === p.id}
                            onClick={() => void cancelarPoderPendiente(p.id)}
                          >
                            {cancelandoPoderId === p.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Cancelar solicitud
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {unidades.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-6">
                  Ingresa con tu correo o teléfono registrado para gestionar poderes.
                </p>
              )}
            </div>
          )}

          {/* ── TAB: MIS DATOS (perfil resumido) ── */}
          {tabActivo === 'misdatos' && (
            <div className="space-y-4">
              {/* Header usuario */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">¡Bienvenido!</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCerrarSesionVotante}
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0 text-xs"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    Salir
                  </Button>
                </div>
              </div>

              {/* Unidades */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center text-sm">
                  <Users className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                  Estás votando por:
                </h3>
                {unidadesPropias.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">🏠 Tus unidades:</p>
                    <div className="space-y-1.5">
                      {unidadesPropias.map((unidad) => (
                        <div key={unidad.id} className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">{unidad.torre} - {unidad.numero}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Coef. {unidad.coeficiente.toFixed(4)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {unidadesPoderes.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">📝 Poderes:</p>
                    <div className="space-y-1.5">
                      {unidadesPoderes.map((unidad) => (
                        <div key={unidad.id} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2.5 border border-purple-200 dark:border-purple-800">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">{unidad.torre} - {unidad.numero}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Coef. {unidad.coeficiente.toFixed(4)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-3 border-t border-green-200 dark:border-green-800 flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white text-sm">TOTAL:</span>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{unidades.length} unidad{unidades.length !== 1 ? 'es' : ''}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{totalCoeficiente.toFixed(6)}% coeficiente</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 text-center sm:text-left">
                  Para declarar un poder o ver solicitudes en verificación, abre la pestaña{' '}
                  <button
                    type="button"
                    className="text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-2"
                    onClick={() => setTabActivo('poderes')}
                  >
                    Poderes
                  </button>
                  .
                </p>
              </div>

              {/* Estado de verificación */}
              {yaVerifico && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  Has verificado tu asistencia en esta asamblea.
                </div>
              )}
              {!yaVerifico && verificacionActiva && (
                <button
                  type="button"
                  onClick={handleVerificarAsistencia}
                  disabled={verificando}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {verificando ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <UserCheck className="w-4 h-4" />}
                  Verificar mi asistencia ahora
                </button>
              )}

              {/* Acciones */}
              <Button
                onClick={() => setShowModalCertificado(true)}
                disabled={descargandoCertificado}
                variant="outline"
                className="w-full border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm"
              >
                <FileDown className={`w-4 h-4 mr-2 ${descargandoCertificado ? 'animate-pulse' : ''}`} />
                Certificado de mis votos
              </Button>
            </div>
          )}

          {/* Modal: mensaje antes de generar certificado (compartido entre tabs) */}
          <Dialog open={showModalCertificado} onOpenChange={setShowModalCertificado}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-white">Certificado de mis votos</DialogTitle>
                <DialogDescription>
                  Este certificado no consume tokens; límite: 3 por hora.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowModalCertificado(false)}
                  className="w-full sm:flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  className="w-full sm:flex-1"
                  onClick={async () => {
                    setShowModalCertificado(false)
                    setDescargandoCertificado(true)
                    try {
                      const res = await fetch('/api/votar/certificado-mis-votos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ codigo, email: email.trim() }),
                      })
                      const text = await res.text()
                      if (!res.ok) {
                        let msg = 'No se pudo generar el certificado.'
                        try {
                          const data = JSON.parse(text)
                          if (data?.error) msg = data.error
                        } catch {
                          // ignorar
                        }
                        if (res.status === 429) {
                          toast.info(msg)
                        } else {
                          toast.error(msg)
                        }
                        return
                      }
                      const blob = new Blob([text], { type: 'text/html;charset=utf-8' })
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank', 'noopener,noreferrer')
                      setTimeout(() => URL.revokeObjectURL(url), 60000)
                      toast.success('Certificado abierto. Puedes imprimirlo o guardar como PDF.')
                    } catch (e) {
                      toast.error('Error al descargar el certificado.')
                    } finally {
                      setDescargandoCertificado(false)
                    }
                  }}
                >
                  Generar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* El historial ahora está en Tab 2 (Avance). Se carga automáticamente al entrar. */}
          {false && mostrarHistorial && (
            <div className="mt-8">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <History className="w-6 h-6 mr-3 text-purple-600 dark:text-purple-400" />
                    Historial de Votaciones
                  </h2>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Preguntas cerradas
                  </span>
                </div>

                {preguntasCerradas.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No hay preguntas cerradas en esta asamblea.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {preguntasCerradas.map((pregunta, index) => {
                      const stats = estadisticasCerradas[pregunta.id]
                      const misVotos = votosHistorico.filter(v => v.pregunta_id === pregunta.id)

                      return (
                        <div key={pregunta.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                          {/* Header */}
                          <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                                Pregunta {index + 1}
                              </span>
                              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                CERRADA
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-white">
                              {pregunta.texto_pregunta}
                            </h3>
                            {pregunta.descripcion && (
                              <p className="text-white/80 text-sm mt-1">
                                {pregunta.descripcion}
                              </p>
                            )}
                          </div>

                          <div className="p-4">
                            {/* Mis Votos */}
                            {misVotos.length > 0 && (
                              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                                  Tus votos:
                                </h4>
                                <div className="space-y-2">
                                  {misVotos.map((voto) => {
                                    const unidad = unidades.find(u => u.id === voto.unidad_id)
                                    return (
                                      <div key={`${voto.pregunta_id}-${voto.unidad_id}`} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700 dark:text-gray-300">
                                          {unidad?.torre} - {unidad?.numero}:
                                        </span>
                                        <span className="font-semibold text-green-700 dark:text-green-400">
                                          {voto.opcion_texto}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Resultados Finales */}
                            {stats && stats.resultados && stats.resultados.length > 0 && (() => {
                              const tipoVotCerrada = stats.tipo_votacion ?? pregunta.tipo_votacion ?? 'coeficiente'
                              const tvC = stats.total_votos || 0
                              const tuC = totalUnidadesConjunto
                              const sinVC = tuC != null ? Math.max(0, tuC - tvC) : null
                              const ppC = stats.porcentaje_participacion || 0
                              const pendC = Math.max(0, 100 - ppC)
                              return (
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-3">
                                  📊 Resultados finales:
                                </h4>
                                <div className="space-y-2">
                                  {stats.resultados.map((resultado: any) => {
                                    const porcentaje = pctRelevante(resultado, tipoVotCerrada)
                                    return (
                                      <div key={resultado.opcion_id} className="relative">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {resultado.opcion_texto}
                                          </span>
                                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {porcentaje.toFixed(2)}%
                                          </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                          <div
                                            className="h-full transition-all duration-500 rounded-full"
                                            style={{
                                              width: `${Math.min(porcentaje, 100)}%`,
                                              backgroundColor: resultado.color || '#6366f1'
                                            }}
                                          />
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          {resultado.votos_cantidad || 0} voto{(resultado.votos_cantidad || 0) !== 1 ? 's' : ''}
                                          {tipoVotCerrada === 'coeficiente' && (
                                            <> • {parseFloat(resultado.votos_coeficiente || 0).toFixed(2)}% coeficiente</>
                                          )}
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>

                                {/* Siempre hay umbral: el definido o el por defecto (mayoría simple 51%) */}
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  {(() => {
                                    const umbralEfectivo = pregunta.umbral_aprobacion ?? UMBRAL_APROBACION_DEFECTO
                                    const maxPct = Math.max(...stats.resultados.map((r: any) => pctRelevante(r, tipoVotCerrada)))
                                    const aprobado = maxPct >= umbralEfectivo
                                    return (
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">
                                          Umbral de aprobación: {umbralEfectivo}%
                                          {pregunta.umbral_aprobacion == null && (
                                            <span className="text-gray-500 dark:text-gray-400 ml-1">(mayoría simple)</span>
                                          )}
                                        </span>
                                        <span className={`font-semibold ${aprobado ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                          {aprobado ? '✓ Aprobado' : '○ No aprobado'} — Opción líder: {maxPct.toFixed(2)}% (umbral ≥{umbralEfectivo}%)
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </div>
                                {/* Participación Total */}
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <div className="flex justify-between items-center text-sm flex-wrap gap-x-2 gap-y-1">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      Participación en esta pregunta
                                      {tipoVotCerrada === 'coeficiente' ? ' (coeficiente del conjunto)' : ' (unidades)'}:
                                    </span>
                                    <span className="font-bold text-gray-900 dark:text-white text-right max-w-[min(100%,20rem)]">
                                      {tuC != null ? (
                                        <>
                                          <span className="tabular-nums">{tvC}</span>/
                                          <span className="tabular-nums">{tuC}</span>
                                          {' · '}
                                          {sinVC != null && sinVC > 0 && (
                                            <>
                                              <span className="tabular-nums">{sinVC}</span> sin votar ·{' '}
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          {tvC} {tvC === 1 ? 'voto' : 'votos'} ·{' '}
                                        </>
                                      )}
                                      {ppC.toFixed(2)}% emitido · {pendC.toFixed(2)}% pendiente
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )})()}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
