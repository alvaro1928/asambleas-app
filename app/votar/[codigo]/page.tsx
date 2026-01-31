'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, AlertTriangle, Vote, Users, ChevronRight, BarChart3, Clock, RefreshCw, History, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { useToast } from '@/components/providers/ToastProvider'

const STORAGE_EMAIL_KEY = (codigo: string) => `votar_email_${codigo}`

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
  }>
}

export default function VotacionPublicaPage() {
  const params = useParams()
  const codigo = params.codigo as string
  const toast = useToast()

  const [step, setStep] = useState<'validando' | 'email' | 'verificando' | 'votar' | 'error'>('validando')
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
  const [clientIp, setClientIp] = useState<string | null>(null)

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
      setStep('votar')
      try {
        const res = await fetch('/api/client-info', { credentials: 'include' })
        const info = await res.json()
        if (info?.ip) setClientIp(info.ip)
      } catch {
        // Ignorar; ip es opcional para trazabilidad
      }
      await cargarPreguntas(unidadesConInfo)

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

  const cargarPreguntas = async (unidadesParam?: UnidadInfo[]) => {
    if (!asamblea) return

    try {
      // Usar unidades del parámetro o del estado
      const unidadesParaUsar = unidadesParam || unidades

      // Cargar preguntas abiertas
      const { data: preguntasData, error: preguntasError } = await supabase
        .from('preguntas')
        .select('id, texto_pregunta, descripcion, tipo_votacion, estado')
        .eq('asamblea_id', asamblea.asamblea_id)
        .eq('estado', 'abierta')
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
        .select('id, texto_pregunta, descripcion, tipo_votacion, estado')
        .eq('asamblea_id', asamblea.asamblea_id)
        .eq('estado', 'cerrada')
        .order('created_at', { ascending: false }) // Más recientes primero

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
            resultados: resultados
          }
        } else {
          // Si no hay datos, crear estructura vacía
          estadisticasMap[preguntaId] = {
            total_votos: 0,
            total_coeficiente: 0,
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

  // Polling para actualizar estadísticas y votos cada 10 segundos
  useEffect(() => {
    if (step !== 'votar' || preguntas.length === 0 || unidades.length === 0) return

    // Delay inicial de 5 segundos antes de empezar el polling
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        cargarVotosActuales(preguntas.map(p => p.id), unidades)
        cargarEstadisticas(preguntas.map(p => p.id))
      }, 10000)

      // Limpiar intervalo cuando el componente se desmonte
      return () => clearInterval(interval)
    }, 5000)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling when step or list lengths change
  }, [step, preguntas.length, unidades.length])

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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Validando código de acceso...</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-red-200 dark:border-red-800">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Acceso Denegado
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <StepIndicator pasoActual="email" />
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <Vote className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Votación Virtual
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Código: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{codigo}</span>
            </p>
          </div>

          {/* Información de la Asamblea */}
          {asamblea && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6 border border-indigo-200 dark:border-indigo-800">
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
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-lg py-6"
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

  if (step === 'votar') {
    const totalCoeficiente = unidades.reduce((sum, u) => sum + u.coeficiente, 0)
    const unidadesPropias = unidades.filter(u => !u.es_poder)
    const unidadesPoderes = unidades.filter(u => u.es_poder)
    const todasVotadas =
      preguntas.length > 0 &&
      preguntas.every((p) =>
        unidades.every((u) => votosActuales.some((v) => v.pregunta_id === p.id && v.unidad_id === u.id))
      )

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <StepIndicator pasoActual="votar" />
          {/* Pantalla de éxito cuando terminó de votar en todas las unidades */}
          {todasVotadas && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6 border-2 border-emerald-300 dark:border-emerald-700 text-center">
              <div className="mx-auto w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Gracias, tu participación quedó registrada
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Has votado con todas tus unidades en las preguntas abiertas.
              </p>
              <Button
                onClick={() => {
                  setMostrarHistorial(true)
                  if (preguntasCerradas.length === 0) cargarHistorial(unidades)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                title="Ver historial de votaciones cerradas"
              >
                <History className="w-4 h-4 mr-2" />
                Ver historial
              </Button>
            </div>
          )}
          {/* Header de Bienvenida */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center justify-center sm:justify-start">
                <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    ¡Bienvenido!
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                    {email}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  marcarSalidaQuorum()
                  setStep('email')
                }}
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
                title="Salir y volver a ingresar con otro correo"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Salir de la votación
              </Button>
            </div>

            {/* Resumen de Unidades */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                Estás votando por:
              </h3>

              {/* Unidades Propias */}
              {unidadesPropias.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    🏠 Tus unidades:
                  </p>
                  <div className="space-y-2">
                    {unidadesPropias.map((unidad) => (
                      <div key={unidad.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {unidad.torre} - {unidad.numero}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Coeficiente: {unidad.coeficiente.toFixed(6)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Poderes */}
              {unidadesPoderes.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    📝 Poderes otorgados:
                  </p>
                  <div className="space-y-2">
                    {unidadesPoderes.map((unidad) => (
                      <div key={unidad.id} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {unidad.torre} - {unidad.numero}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Coeficiente: {unidad.coeficiente.toFixed(6)}%
                          </span>
                        </div>
                        {unidad.nombre_otorgante && (
                          <p className="text-xs text-purple-600 dark:text-purple-400">
                            Poder de: {unidad.nombre_otorgante}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">
                    TOTAL:
                  </span>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {unidades.length} unidad{unidades.length !== 1 ? 'es' : ''}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {totalCoeficiente.toFixed(6)}% del coeficiente total
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="mt-6 flex gap-3 justify-center">
              <Button
                onClick={refrescarDatos}
                disabled={recargando}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                title="Recargar preguntas y poderes asignados"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${recargando ? 'animate-spin' : ''}`} />
                {recargando ? 'Actualizando...' : 'Actualizar Todo (Preguntas y Poderes)'}
              </Button>
              
              <Button
                onClick={() => {
                  setMostrarHistorial(!mostrarHistorial)
                  if (!mostrarHistorial && preguntasCerradas.length === 0) {
                    cargarHistorial(unidades)
                  }
                }}
                variant="outline"
                className="border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                title="Ver el historial de votos que has emitido"
              >
                <History className="w-4 h-4 mr-2" />
                {mostrarHistorial ? 'Ocultar' : 'Ver'} Historial
              </Button>
            </div>
          </div>

          {/* Preguntas de Votación */}
          <div className="space-y-6">
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
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                              Pregunta {index + 1}
                            </span>
                            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                              ABIERTA
                            </span>
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">
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
                                  // Usar porcentaje sobre coeficiente TOTAL del conjunto (Ley 675)
                                  const porcentajeTotal = stats_opcion?.porcentaje_coeficiente_total ?? 
                                    stats_opcion?.porcentaje_coeficiente ?? 0
                                  
                                  // Porcentaje sobre los que ya votaron (referencia)
                                  const porcentajeEmitidos = stats_opcion?.porcentaje_coeficiente_emitido ?? 
                                    stats_opcion?.porcentaje_coeficiente ?? 0

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

                      {/* Estadísticas */}
                      {stats && stats.total_votos !== undefined && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Participación General
                            </h4>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Actualización cada 10s
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Votos</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {stats.total_votos || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Coeficiente</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {(stats.total_coeficiente || 0).toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Participación</p>
                              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                {(stats.porcentaje_participacion || 0).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          {stats.porcentaje_participacion !== undefined && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                ℹ️ Porcentajes mostrados son sobre el coeficiente total del conjunto (Ley 675)
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Historial de Votaciones Cerradas */}
          {mostrarHistorial && (
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
                            {stats && stats.resultados && stats.resultados.length > 0 && (
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-3">
                                  📊 Resultados finales:
                                </h4>
                                <div className="space-y-2">
                                  {stats.resultados.map((resultado: any) => {
                                    const porcentaje = parseFloat(resultado.porcentaje_coeficiente_total || resultado.porcentaje_coeficiente || 0)
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
                                          {resultado.votos_cantidad || 0} voto{(resultado.votos_cantidad || 0) !== 1 ? 's' : ''} • 
                                          {' '}{parseFloat(resultado.votos_coeficiente || 0).toFixed(2)}% coeficiente
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>

                                {/* Participación Total */}
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      Participación total:
                                    </span>
                                    <span className="font-bold text-gray-900 dark:text-white">
                                      {stats.total_votos || 0} votos • {(stats.porcentaje_participacion || 0).toFixed(2)}% del coeficiente
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
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
