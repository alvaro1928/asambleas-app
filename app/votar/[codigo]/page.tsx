'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, AlertTriangle, Vote, Users, ChevronRight, ChevronDown, ChevronUp, BarChart3, Clock, RefreshCw, History, LogOut, FileDown, XCircle, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { useToast } from '@/components/providers/ToastProvider'

const STORAGE_EMAIL_KEY = (codigo: string) => `votar_email_${codigo}`

/** Umbral por defecto según Ley 675: mayoría simple (>50%) — 51% para aprobación */
const UMBRAL_APROBACION_DEFECTO = 51

function mensajeErrorAmigable(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('no se encontraron unidades') || m.includes('length === 0')) return 'Este correo o teléfono no está asociado a ninguna unidad en esta asamblea. Revisa el dato o contacta al administrador.'
  if (m.includes('no puede votar') || m.includes('puede_votar')) return 'No tienes permiso para votar en esta asamblea con este correo o teléfono. Verifica que tengas una unidad o poder asignado.'
  if (m.includes('código') && m.includes('inválido')) return 'El código de acceso no es válido. Verifica que hayas escaneado correctamente el QR o que el enlace sea el indicado.'
  if (m.includes('acceso') && m.includes('cerrado')) return 'El acceso a esta votación está cerrado. Contacta al administrador si crees que es un error.'
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
}

interface UnidadInfo {
  id: string
  torre: string
  numero: string
  coeficiente: number
  es_poder: boolean
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
  const codigo = params.codigo as string
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
  const [votando, setVotando] = useState<string | null>(null)
  const [recargando, setRecargando] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [descargandoCertificado, setDescargandoCertificado] = useState(false)
  const [showModalCertificado, setShowModalCertificado] = useState(false)
  const [clientIp, setClientIp] = useState<string | null>(null)
  const [consentimientoAceptado, setConsentimientoAceptado] = useState(false)
  const [guardandoConsentimiento, setGuardandoConsentimiento] = useState(false)
  const [avanceColapsado, setAvanceColapsado] = useState(false)

  // --- Verificación de Quórum ---
  const [verificacionActiva, setVerificacionActiva] = useState(false)
  const [yaVerifico, setYaVerifico] = useState(false)
  const [verificando, setVerificando] = useState(false)
  interface StatsVerif { total_verificados: number; coeficiente_verificado: number; porcentaje_verificado: number; quorum_alcanzado: boolean }
  const [statsVerificacion, setStatsVerificacion] = useState<StatsVerif | null>(null)
  // --- Tabs ---
  const [tabActivo, setTabActivo] = useState<'votacion' | 'avance' | 'misdatos'>('votacion')

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
    validarCodigo()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when codigo changes
  }, [codigo])

  const validarCodigo = async () => {
    try {
      const { data, error } = await supabase.rpc('validar_codigo_acceso', {
        p_codigo: codigo
      })

      if (error) throw error

      if (!data || data.length === 0) {
        setError(mensajeErrorAmigable('Código de acceso inválido'))
        setStep('error')
        return
      }

      const asambleaData = data[0]

      if (!asambleaData.acceso_valido) {
        setError(mensajeErrorAmigable(asambleaData.mensaje || 'Acceso denegado'))
        setStep('error')
        return
      }

      setAsamblea(asambleaData)
      setStep('email')
      try {
        const guardado = typeof window !== 'undefined' && localStorage.getItem(STORAGE_EMAIL_KEY(codigo))
        if (guardado) setEmail(guardado)
      } catch {
        // Ignorar si localStorage no está disponible
      }
    } catch (error: any) {
      console.error('Error validando código:', error)
      setError(mensajeErrorAmigable(error?.message || 'Error al validar el código de acceso'))
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
      const identificador = email.trim().toLowerCase()
      const consentRes = await fetch(
        `/api/votar/consentimiento?codigo=${encodeURIComponent(codigo)}&identificador=${encodeURIComponent(identificador)}`,
        { credentials: 'include' }
      )
      const consentData = consentRes.ok ? await consentRes.json().catch(() => ({})) : {}
      if (consentData.accepted) {
        setStep('votar')
        await cargarPreguntas(unidadesConInfo)
      } else {
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
    const identificador = email.trim()
    const { data, error } = await supabase.rpc('validar_votante_asamblea', {
      p_codigo_asamblea: codigo,
      p_email_votante: identificador.includes('@') ? identificador.toLowerCase() : identificador
    })

    if (error) throw error

    if (!data || data.length === 0) {
      return []
    }

    const resultado = data[0]

    if (!resultado.puede_votar) {
      throw new Error(resultado.mensaje || 'No puede votar')
    }

    // Obtener información detallada de las unidades
    const unidadesIds = [
      ...(resultado.unidades_propias || []),
      ...(resultado.unidades_poderes || [])
    ]

    if (unidadesIds.length === 0) {
      return []
    }

    const { data: unidadesData, error: unidadesError } = await supabase
      .from('unidades')
      .select('id, torre, numero, coeficiente, nombre_propietario')
      .in('id', unidadesIds)

    if (unidadesError) throw unidadesError

    // Marcar cuáles son poderes
    const unidadesPoderes = resultado.unidades_poderes || []

    const unidadesConInfo: UnidadInfo[] = (unidadesData || []).map((u: any) => ({
      id: u.id,
      torre: u.torre,
      numero: u.numero,
      coeficiente: u.coeficiente,
      es_poder: unidadesPoderes.includes(u.id),
      nombre_otorgante: u.nombre_propietario
    }))

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
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Error al registrar la aceptación')
        return
      }
      setStep('votar')
      await cargarPreguntas(unidades)
    } catch (err: any) {
      setError(err?.message ?? 'Error al continuar')
    } finally {
      setGuardandoConsentimiento(false)
    }
  }

  const cargarPreguntas = async (unidadesParam?: UnidadInfo[]) => {
    if (!asamblea) return

    try {
      // Usar unidades del parámetro o del estado
      const unidadesParaUsar = unidadesParam || unidades

      // Cargar preguntas abiertas
      const { data: preguntasData, error: preguntasError } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, descripcion, tipo_votacion, estado, umbral_aprobacion')
        .eq('asamblea_id', asamblea.asamblea_id)
        .eq('estado', 'abierta')
        .eq('is_archived', false)
        .order('created_at', { ascending: true })

      if (preguntasError) throw preguntasError

      if (!preguntasData || preguntasData.length === 0) {
        setPreguntas([])
        return
      }

      const preguntaIds = preguntasData.map((p: { id: string }) => p.id)
      const { data: opcionesData } = await supabase
        .from('opciones_pregunta')
        .select('id, pregunta_id, texto_opcion, color, orden')
        .in('pregunta_id', preguntaIds)
        .order('orden', { ascending: true })

      const opcionesPorPregunta: Record<string, { id: string; texto: string; color: string }[]> = {}
      for (const p of preguntasData) {
        opcionesPorPregunta[p.id] = []
      }
      for (const o of opcionesData || []) {
        const pid = (o as { pregunta_id: string }).pregunta_id
        if (opcionesPorPregunta[pid]) {
          opcionesPorPregunta[pid].push({
            id: o.id,
            texto: o.texto_opcion,
            color: o.color
          })
        }
      }

      const preguntasConOpciones: Pregunta[] = preguntasData.map((p: any) => ({
        ...p,
        opciones: opcionesPorPregunta[p.id] || []
      }))

      setPreguntas(preguntasConOpciones)

      // Cargar votos actuales del votante usando las unidades correctas
      if (unidadesParaUsar && unidadesParaUsar.length > 0) {
        await cargarVotosActuales(preguntasConOpciones.map(p => p.id), unidadesParaUsar)
      }

      // Cargar estadísticas
      await cargarEstadisticas(preguntasConOpciones.map(p => p.id))

    } catch (error: any) {
      // Ignorar errores de AbortError (son normales cuando hay cancelaciones)
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return
      console.error('Error cargando preguntas:', error)
    }
  }

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

      // Cargar votos históricos del votante
      if (unidadesParaUsar && unidadesParaUsar.length > 0) {
        const unidadIds = unidadesParaUsar.map(u => u.id)
        
        const { data: votosData } = await supabase
          .from('votos')
          .select('pregunta_id, unidad_id, opcion_id, opciones_pregunta(texto_opcion)')
          .in('pregunta_id', preguntasConOpciones.map(p => p.id))
          .in('unidad_id', unidadIds)

        if (votosData && votosData.length > 0) {
          const votosMap = votosData.map((v: any) => ({
            pregunta_id: v.pregunta_id,
            unidad_id: v.unidad_id,
            opcion_id: v.opcion_id,
            opcion_texto: v.opciones_pregunta?.texto_opcion || ''
          }))
          setVotosHistorico(votosMap)
        }
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
      const unidadIds = unidadesParaUsar.map(u => u.id)

      const { data: votosData, error } = await supabase
        .from('votos')
        .select('pregunta_id, unidad_id, opcion_id, opciones_pregunta(texto_opcion)')
        .in('pregunta_id', preguntaIds)
        .in('unidad_id', unidadIds)

      if (votosData && votosData.length > 0) {
        const votosMap: any[] = votosData.map((v: any) => ({
          pregunta_id: v.pregunta_id,
          unidad_id: v.unidad_id,
          opcion_id: v.opcion_id,
          opcion_texto: v.opciones_pregunta?.texto_opcion || ''
        }))
        setVotosActuales(votosMap)
      } else {
        setVotosActuales([])
      }
    } catch (error: any) {
      // Ignorar errores de AbortError
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return
      console.error('Error cargando votos actuales:', error)
    }
  }

  const cargarEstadisticas = async (preguntaIds: string[]) => {
    try {
      const estadisticasMap: Record<string, EstadisticasPregunta> = {}

      for (const preguntaId of preguntaIds) {
        const { data, error } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: preguntaId
        })

        if (!error && data && data.length > 0) {
          const statsData = data[0]
          
          // Parsear resultados si es string
          let resultados = []
          if (typeof statsData.resultados === 'string') {
            try {
              resultados = JSON.parse(statsData.resultados)
            } catch (e) {
              console.error('Error parsing resultados:', e)
              resultados = []
            }
          } else if (Array.isArray(statsData.resultados)) {
            resultados = statsData.resultados
          } else {
            // Si es un objeto JSONB de PostgreSQL
            resultados = statsData.resultados || []
          }

          console.log('📈 Resultados procesados:', resultados)

          estadisticasMap[preguntaId] = {
            total_votos: parseInt(statsData.total_votos) || 0,
            total_coeficiente: parseFloat(statsData.total_coeficiente) || 0,
            porcentaje_participacion: parseFloat(statsData.porcentaje_participacion) || 0,
            tipo_votacion: (statsData.tipo_votacion ?? 'coeficiente') as string,
            resultados: resultados
          }
        } else {
          // Si no hay datos, crear estructura vacía
          estadisticasMap[preguntaId] = {
            total_votos: 0,
            total_coeficiente: 0,
            porcentaje_participacion: 0,
            tipo_votacion: 'coeficiente',
            resultados: []
          }
        }
      }

      setEstadisticas(estadisticasMap)
    } catch (error: any) {
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return
      console.error('Error cargando estadísticas:', error)
    }
  }

  const cargarEstadisticasCerradas = async (preguntaIds: string[]) => {
    try {
      const estadisticasMap: Record<string, EstadisticasPregunta> = {}

      for (const preguntaId of preguntaIds) {
        const { data: statsData, error } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: preguntaId
        })

        if (statsData && !error) {
          let resultados = []
          
          if (typeof statsData.resultados === 'string') {
            try {
              const parsed = JSON.parse(statsData.resultados)
              resultados = Array.isArray(parsed) ? parsed : []
            } catch (e) {
              resultados = []
            }
          } else if (Array.isArray(statsData.resultados)) {
            resultados = statsData.resultados
          } else {
            resultados = statsData.resultados || []
          }

          estadisticasMap[preguntaId] = {
            total_votos: parseInt(statsData.total_votos) || 0,
            total_coeficiente: parseFloat(statsData.total_coeficiente) || 0,
            coeficiente_total_conjunto: parseFloat(statsData.coeficiente_total_conjunto) || 100,
            porcentaje_participacion: parseFloat(statsData.porcentaje_participacion) || 0,
            tipo_votacion: (statsData.tipo_votacion ?? 'coeficiente') as string,
            resultados: resultados
          }
        }
      }

      setEstadisticasCerradas(estadisticasMap)
    } catch (error: any) {
      // Ignorar errores de AbortError
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return
      console.error('Error cargando estadísticas cerradas:', error)
    }
  }

  const refrescarDatos = async () => {
    setRecargando(true)
    try {
      // Re-validar unidades y poderes (por si se agregaron nuevos poderes)
      const nuevasUnidades = await refrescarUnidades()
      
      await cargarPreguntas(nuevasUnidades)
      if (mostrarHistorial) {
        await cargarHistorial(nuevasUnidades)
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

      const { error } = await supabase.rpc('registrar_voto_con_trazabilidad', {
        p_pregunta_id: preguntaId,
        p_unidad_id: unidadId,
        p_opcion_id: opcionId,
        p_votante_email: email.toLowerCase().trim(),
        p_votante_nombre: unidad.nombre_otorgante || 'Votante',
        p_es_poder: unidad.es_poder,
        p_poder_id: null,
        p_ip_address: clientIp || null,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
      })

      if (error) throw error

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

  // Función auxiliar: refresca flag de verificación + stats de quórum verificado
  const refrescarVerificacion = async (asambleaId: string, emailVotante?: string) => {
    try {
      const queries: Promise<any>[] = [
        supabase.from('asambleas').select('verificacion_asistencia_activa').eq('id', asambleaId).single(),
        supabase.rpc('calcular_verificacion_quorum', { p_asamblea_id: asambleaId }),
      ]
      // Si tenemos el email del votante, verificar si ya registró asistencia (persiste entre recargas)
      if (emailVotante) {
        queries.push(
          supabase
            .from('quorum_asamblea')
            .select('verifico_asistencia')
            .eq('asamblea_id', asambleaId)
            .ilike('email_propietario', emailVotante.trim().toLowerCase())
            .eq('verifico_asistencia', true)
            .limit(1)
        )
      }

      const results = await Promise.all(queries)
      const [{ data: aData }, { data: vData }, yaVerificoDB] = results

      if (aData) setVerificacionActiva(!!(aData as any).verificacion_asistencia_activa)
      if (vData?.length) {
        const v = vData[0] as StatsVerif
        setStatsVerificacion({
          total_verificados: Number(v.total_verificados) || 0,
          coeficiente_verificado: Number(v.coeficiente_verificado) || 0,
          porcentaje_verificado: Number(v.porcentaje_verificado) || 0,
          quorum_alcanzado: !!v.quorum_alcanzado,
        })
      }
      // Si la BD confirma que ya verificó, setear estado local para no mostrar popup
      if (yaVerificoDB?.data?.length) setYaVerifico(true)
    } catch {
      // ignorar errores silenciosos de polling
    }
  }

  // Polling: re-fetch unidades/poderes y listado de preguntas cada 10 s (para que al agregar un poder o cerrar/abrir pregunta el votante vea el cambio sin refrescar)
  useEffect(() => {
    if (step !== 'votar' || !asamblea || !email.trim()) return

    // Carga inicial de verificación — incluye email para detectar si ya verificó antes
    refrescarVerificacion(asamblea.asamblea_id, email.trim())

    const timeout = setTimeout(() => {
      const interval = setInterval(async () => {
        try {
          const nuevasUnidades = await refrescarUnidades()
          if (nuevasUnidades.length > 0) {
            await cargarPreguntas(nuevasUnidades)
            await cargarHistorial(nuevasUnidades)
          }
          // Actualizar estado de verificación de quórum (sin email en polling, ya tenemos yaVerifico)
          await refrescarVerificacion(asamblea.asamblea_id)
        } catch {
          // Ignorar errores de red o validación en background
        }
      }, 10000)
      return () => clearInterval(interval)
    }, 5000)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling when step or asamblea changes
  }, [step, asamblea?.asamblea_id, email])

  // Cargar historial al cambiar al tab de avance
  useEffect(() => {
    if (tabActivo === 'avance' && step === 'votar' && unidades.length > 0 && preguntasCerradas.length === 0) {
      cargarHistorial(unidades)
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
        await refrescarVerificacion(asamblea.asamblea_id)
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
                <li>• El código ha expirado o fue desactivado</li>
                <li>• El código es incorrecto</li>
                <li>• El acceso público está cerrado</li>
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
          <StepIndicator pasoActual="email" />
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
                Email o teléfono registrado en la unidad
              </label>
              <Input
                type="text"
                inputMode="email"
                autoComplete="email tel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com o 3001234567"
                className="w-full text-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleValidarEmail()}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ℹ️ Ingresa el email o el número de teléfono registrado en tu unidad o con el que tienes poderes
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
              🔒 Solo podrás votar si tu email o teléfono está registrado en una unidad del conjunto.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'consentimiento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 overflow-x-hidden">
        <div className="max-w-md w-full min-w-0 bg-surface dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-8 border border-border dark:border-gray-700">
          <StepIndicator pasoActual="consentimiento" />
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
      { id: 'misdatos' as const, label: 'Mis datos', short: 'Mis datos' },
    ]

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800">
        {/* Popup de Verificación de Quórum */}
        <Dialog open={verificacionActiva && !yaVerifico} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Verificación de Asistencia
              </DialogTitle>
              <DialogDescription>
                El administrador solicita confirmar que estás presente en esta asamblea. Al confirmar, quedará registro oficial de tu asistencia en el acta.
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
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setYaVerifico(true)}
                disabled={verificando}
              >
                Más tarde
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
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

        {/* Header fijo con indicador de quórum */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{asamblea?.nombre_conjunto}</p>
                <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">{asamblea?.nombre}</h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {statsVerificacion && (
                  <QuorumChip pct={statsVerificacion.porcentaje_verificado} total={statsVerificacion.total_verificados} />
                )}
                {yaVerifico && !statsVerificacion && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Verificado
                  </span>
                )}
              </div>
            </div>
            {/* Tabs */}
            <div className="flex w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabActivo(tab.id)}
                  className={`flex-1 py-2 text-xs sm:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    tabActivo === tab.id
                      ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.short}</span>
                  {tab.id === 'votacion' && preguntas.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold">{preguntas.length}</span>
                  )}
                  {tab.id === 'avance' && todasVotadas && (
                    <span className="ml-1 text-green-500">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 pb-10">
          <StepIndicator pasoActual="votar" />

          {/* ── TAB 1: VOTACIÓN ── */}
          {tabActivo === 'votacion' && (
            <div className="space-y-4">
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
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700 text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No hay preguntas abiertas
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  En este momento no hay preguntas disponibles para votar. El administrador abrirá las preguntas cuando inicie la votación.
                </p>
              </div>
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
                              {/* Header de la unidad */}
                              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                                <div>
                                  <p className="font-bold text-gray-900 dark:text-white">
                                    {unidad.torre} - {unidad.numero}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Coeficiente: {unidad.coeficiente.toFixed(6)}%
                                    {unidad.es_poder && (
                                      <span className="ml-2 text-purple-600 dark:text-purple-400">• Poder</span>
                                    )}
                                  </p>
                                </div>
                                {votoUnidad && (
                                  <div className="text-right">
                                    <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                                      ✓ Votado
                                    </span>
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
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
                                      className={`
                                        w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden
                                        ${esVotoActual 
                                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 ring-2 ring-green-500' 
                                          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-gray-800'
                                        }
                                        ${votando === pregunta.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                      `}
                                    >
                                      <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-3 h-3 rounded-full border-2"
                                            style={{ 
                                              backgroundColor: esVotoActual ? opcion.color : 'transparent',
                                              borderColor: opcion.color 
                                            }}
                                          />
                                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {opcion.texto}
                                          </span>
                                          {esVotoActual && (
                                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                                              ✓
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
              {statsVerificacion && (
                <div className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                  statsVerificacion.quorum_alcanzado
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : statsVerificacion.porcentaje_verificado >= 30
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <UserCheck className={`w-4 h-4 shrink-0 ${pctColor(statsVerificacion.porcentaje_verificado)}`} />
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    Quórum verificado: <span className={`font-bold ${pctColor(statsVerificacion.porcentaje_verificado)}`}>{statsVerificacion.porcentaje_verificado.toFixed(1)}%</span>
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
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Umbral de aprobación: {UMBRAL_APROBACION_DEFECTO}% (mayoría simple). Se actualiza automáticamente.
              </p>

              {/* Preguntas abiertas */}
              {preguntas.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
                    Preguntas abiertas
                  </h3>
                  {preguntas.map((pregunta, index) => {
                    const stats = estadisticas[pregunta.id]
                    if (!stats) return null
                    const tipoVot = stats.tipo_votacion ?? pregunta.tipo_votacion ?? 'coeficiente'
                    const participacion = stats.porcentaje_participacion ?? 0
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
                            {statsVerificacion && (
                              <QuorumChip pct={statsVerificacion.porcentaje_verificado} total={statsVerificacion.total_verificados} small />
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${algunaAprobada ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                              {algunaAprobada ? '✓ Aprobada' : '○ Pendiente'}
                            </span>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600 dark:text-gray-400">Participación</span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{participacion.toFixed(2)}% ({stats.total_votos ?? 0} votos)</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(participacion, 100)}%` }} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            {resultados.map((r: { opcion_id?: string; opcion_texto?: string; color?: string; votos_cantidad?: number; porcentaje_coeficiente_total?: number; porcentaje_coeficiente?: number; porcentaje_nominal_total?: number; porcentaje_votos_emitidos?: number }, ri: number) => {
                              const pct = pctRelevante(r, tipoVot)
                              const pasaUmbral = pct >= umbral
                              return (
                                <div key={r.opcion_id ?? `opt-${index}-${ri}`} className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color || '#6366f1' }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="text-gray-700 dark:text-gray-300 truncate">{r.opcion_texto ?? '—'}</span>
                                      <span className={`font-medium shrink-0 ml-2 ${pasaUmbral ? 'text-green-600 dark:text-green-400' : ''}`}>
                                        {pct.toFixed(2)}% ({r.votos_cantidad ?? 0}){pasaUmbral ? ' ✓' : ''}
                                      </span>
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
                            <span className="text-xs font-bold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full shrink-0">CERRADA</span>
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
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{resultado.votos_cantidad || 0} voto{(resultado.votos_cantidad || 0) !== 1 ? 's' : ''}</p>
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

          {/* ── TAB 3: MIS DATOS ── */}
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
                    onClick={() => { marcarSalidaQuorum(); setStep('email') }}
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
                          {unidad.nombre_otorgante && <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">Poder de: {unidad.nombre_otorgante}</p>}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  onClick={refrescarDatos}
                  disabled={recargando}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${recargando ? 'animate-spin' : ''}`} />
                  {recargando ? 'Actualizando...' : 'Actualizar'}
                </Button>
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
              <div className="flex gap-3 mt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowModalCertificado(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
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
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      Participación total:
                                    </span>
                                    <span className="font-bold text-gray-900 dark:text-white">
                                      {stats.total_votos || 0} votos • {(stats.porcentaje_participacion || 0).toFixed(2)}% {tipoVotCerrada === 'nominal' ? 'del total de unidades' : 'del coeficiente'}
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
