'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Plus, 
  Edit,
  Trash2,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  Play,
  Save,
  X,
  AlertTriangle,
  Users,
  Unlock,
  Lock,
  Copy,
  Share2,
  QrCode,
  Link as LinkIcon,
  UserPlus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { getEffectivePlanLimits } from '@/lib/plan-limits'
import { useToast } from '@/components/providers/ToastProvider'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'

interface Asamblea {
  id: string
  nombre: string
  organization_id?: string
  descripcion?: string
  fecha: string
  estado: 'borrador' | 'activa' | 'finalizada'
  codigo_acceso?: string
  url_publica?: string
  acceso_publico?: boolean
  /** Cobro único por asamblea: true = ya se cobró (Activar o Acta); no se vuelve a descontar */
  pago_realizado?: boolean
}

interface Pregunta {
  id: string
  orden: number
  texto_pregunta: string
  descripcion?: string
  tipo_votacion: 'coeficiente' | 'nominal'
  estado: 'pendiente' | 'abierta' | 'cerrada'
  umbral_aprobacion?: number | null
}

interface OpcionPregunta {
  id?: string
  texto_opcion: string
  orden: number
  color: string
}

interface EstadisticaOpcion {
  opcion_id: string
  texto_opcion: string
  color: string
  votos_count: number
  votos_coeficiente: number
  porcentaje_nominal: number
  porcentaje_coeficiente: number
}

interface QuorumData {
  total_unidades: number
  unidades_votantes: number
  unidades_pendientes: number
  coeficiente_total: number
  coeficiente_votante: number
  coeficiente_pendiente: number
  porcentaje_participacion_nominal: number
  porcentaje_participacion_coeficiente: number
  quorum_alcanzado: boolean
}

export default function AsambleaDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')

  // Dialog de nueva pregunta
  const [showNewPregunta, setShowNewPregunta] = useState(false)
  const [savingPregunta, setSavingPregunta] = useState(false)
  const [newPregunta, setNewPregunta] = useState({
    texto_pregunta: '',
    descripcion: '',
    tipo_votacion: 'coeficiente' as 'coeficiente' | 'nominal',
    umbral_aprobacion: null as number | null
  })
  const [opciones, setOpciones] = useState<OpcionPregunta[]>([
    { texto_opcion: 'A favor', orden: 1, color: '#10b981' },
    { texto_opcion: 'En contra', orden: 2, color: '#ef4444' },
    { texto_opcion: 'Me abstengo', orden: 3, color: '#6b7280' }
  ])
  const [opcionesPreguntas, setOpcionesPreguntas] = useState<{ [key: string]: OpcionPregunta[] }>({})
  const [estadisticas, setEstadisticas] = useState<{ [key: string]: EstadisticaOpcion[] }>({})
  const [quorum, setQuorum] = useState<QuorumData | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Dialog de eliminar pregunta
  const [deletingPregunta, setDeletingPregunta] = useState<Pregunta | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Dialog de editar pregunta
  const [editingPregunta, setEditingPregunta] = useState<Pregunta | null>(null)
  const [editForm, setEditForm] = useState({
    texto_pregunta: '',
    descripcion: '',
    tipo_votacion: 'coeficiente' as 'coeficiente' | 'nominal',
    umbral_aprobacion: null as number | null
  })
  const [editOpciones, setEditOpciones] = useState<OpcionPregunta[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  // Billetera de tokens por gestor: puede_operar = tokens >= unidades del conjunto
  const [puedeOperar, setPuedeOperar] = useState(false)
  const [tokensDisponibles, setTokensDisponibles] = useState(0)
  const [costoOperacion, setCostoOperacion] = useState(0)
  const [planLimits, setPlanLimits] = useState({ max_preguntas_por_asamblea: 2, incluye_acta_detallada: false })
  const [precioProCop, setPrecioProCop] = useState<number | null>(null)
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null)
  const [sinTokensModalOpen, setSinTokensModalOpen] = useState(false)
  const [checkoutLoadingSinTokens, setCheckoutLoadingSinTokens] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Registrar voto a nombre de un residente (admin)
  const [showRegistroVotoAdmin, setShowRegistroVotoAdmin] = useState(false)
  const [unidadesParaVoto, setUnidadesParaVoto] = useState<Array<{ id: string; torre: string; numero: string; email_propietario?: string | null }>>([])
  const [unidadRegistroVoto, setUnidadRegistroVoto] = useState('')
  const [votanteEmailRegistro, setVotanteEmailRegistro] = useState('')
  const [votanteNombreRegistro, setVotanteNombreRegistro] = useState('')
  const [votosRegistroPorPregunta, setVotosRegistroPorPregunta] = useState<Record<string, string>>({})
  const [savingRegistroVoto, setSavingRegistroVoto] = useState(false)

  // Cargar datos iniciales
  useEffect(() => {
    loadData()
    
    // Mostrar mensaje de éxito si viene de crear
    if (searchParams.get('success') === 'created') {
      setSuccessMessage('Asamblea creada exitosamente')
      setTimeout(() => setSuccessMessage(''), 5000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
  }, [params.id])

  // Polling para estadísticas (separado)
  useEffect(() => {
    if (preguntas.length === 0) return

    const interval = setInterval(() => {
      if (preguntas.some(p => p.estado === 'abierta')) {
        loadEstadisticas()
        loadQuorum()
      }
    }, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polling when preguntas length changes
  }, [params.id, preguntas.length])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        router.push('/dashboard')
        return
      }

      // Cargar asamblea
      const { data: asambleaData, error: asambleaError } = await supabase
        .from('asambleas')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (asambleaError || !asambleaData) {
        console.error('Error loading asamblea:', asambleaError)
        router.push('/dashboard/asambleas')
        return
      }

      setAsamblea(asambleaData)

      // Billetera por gestor: organization-status devuelve tokens, unidades y puede_operar
      const orgId = asambleaData.organization_id
      const statusRes = await fetch(`/api/dashboard/organization-status?organization_id=${encodeURIComponent(orgId ?? '')}`)
      const statusData = statusRes.ok ? await statusRes.json() : null
      const tokens = Math.max(0, Number(statusData?.tokens_disponibles ?? 0))
      const unidades = Math.max(0, Number(statusData?.unidades_conjunto ?? 0))
      const costo = Math.max(0, Number(statusData?.costo_operacion ?? 0))
      const puede = !!statusData?.puede_operar
      setTokensDisponibles(tokens)
      setCostoOperacion(costo)
      setPuedeOperar(puede)
      const limits = getEffectivePlanLimits(tokens, unidades)
      setPlanLimits(limits)
      const configRes = await fetch('/api/configuracion-global')
      const configData = configRes.ok ? await configRes.json() : null
      if (configData?.precio_por_token_cop != null) setPrecioProCop(Number(configData.precio_por_token_cop))
      if (configData?.whatsapp_number != null && typeof configData.whatsapp_number === 'string') setWhatsappNumber(configData.whatsapp_number)

      // Cargar preguntas
      const { data: preguntasData, error: preguntasError } = await supabase
        .from('preguntas')
        .select('*')
        .eq('asamblea_id', params.id)
        .order('orden', { ascending: true })

      if (preguntasError) {
        console.error('Error loading preguntas:', preguntasError)
      } else {
        setPreguntas(preguntasData || [])
        
        // Cargar opciones para cada pregunta
        if (preguntasData && preguntasData.length > 0) {
          const opcionesMap: { [key: string]: OpcionPregunta[] } = {}
          
          for (const pregunta of preguntasData) {
            const { data: opcionesData } = await supabase
              .from('opciones_pregunta')
              .select('*')
              .eq('pregunta_id', pregunta.id)
              .order('orden', { ascending: true })
            
            if (opcionesData) {
              opcionesMap[pregunta.id] = opcionesData
            }
          }
          
          setOpcionesPreguntas(opcionesMap)
        }
      }

      // Cargar estadísticas y quórum
      await loadEstadisticas()
      await loadQuorum()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEstadisticas = async () => {
    if (preguntas.length === 0) return

    try {
      const statsMap: { [key: string]: EstadisticaOpcion[] } = {}

      for (const pregunta of preguntas) {
        const { data, error } = await supabase.rpc('calcular_estadisticas_pregunta', {
          p_pregunta_id: pregunta.id
        })

        if (!error && data && data.length > 0) {
          const statsData = data[0]
          
          console.log('📊 Admin - Stats raw:', statsData)
          
          // Parsear resultados del nuevo formato
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
            // JSONB de PostgreSQL
            resultados = statsData.resultados || []
          }
          

          // Convertir al formato esperado
          const estadisticasFormateadas: EstadisticaOpcion[] = resultados.map((r: any) => ({
            opcion_id: r.opcion_id,
            texto_opcion: r.opcion_texto,
            color: r.color,
            votos_count: r.votos_cantidad || 0,
            votos_coeficiente: parseFloat(r.votos_coeficiente) || 0,
            // Usar porcentaje según Ley 675 (sobre coeficiente total del conjunto)
            porcentaje_nominal: parseFloat(r.porcentaje_votos_emitidos || r.porcentaje_cantidad || 0),
            porcentaje_coeficiente: parseFloat(r.porcentaje_coeficiente_total || r.porcentaje_coeficiente_emitido || r.porcentaje_coeficiente || 0)
          }))

          statsMap[pregunta.id] = estadisticasFormateadas
        }
      }

      setEstadisticas(statsMap)
    } catch (error) {
      console.error('Error loading estadisticas:', error)
    }
  }

  const loadQuorum = async () => {
    try {
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) return

      // Intentar usar la función RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('calcular_quorum_asamblea', {
        p_asamblea_id: params.id
      })

      if (!rpcError && rpcData && rpcData.length > 0) {
        setQuorum(rpcData[0])
        return
      }

      // Si falla la función RPC (no existe aún), calcular manualmente

      // Obtener total de unidades del conjunto
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, coeficiente')
        .eq('organization_id', selectedConjuntoId)

      const totalUnidades = unidadesData?.length || 0
      const coeficienteTotal = unidadesData?.reduce((sum, u) => sum + u.coeficiente, 0) || 0

      // Obtener unidades que han votado
      const { data: votosData } = await supabase
        .from('votos')
        .select('unidad_id, unidades!inner(coeficiente)')
        .in('pregunta_id', preguntas.map(p => p.id))

      const unidadesVotantesSet = new Set(votosData?.map(v => v.unidad_id) || [])
      const unidadesVotantes = unidadesVotantesSet.size

      const coeficienteVotante = votosData?.reduce((sum: number, v: any) => {
        if (unidadesVotantesSet.has(v.unidad_id)) {
          return sum + (v.unidades?.coeficiente || 0)
        }
        return sum
      }, 0) || 0

      const porcentajeNominal = totalUnidades > 0 ? (unidadesVotantes / totalUnidades) * 100 : 0
      const porcentajeCoeficiente = coeficienteTotal > 0 ? (coeficienteVotante / coeficienteTotal) * 100 : 0

      setQuorum({
        total_unidades: totalUnidades,
        unidades_votantes: unidadesVotantes,
        unidades_pendientes: totalUnidades - unidadesVotantes,
        coeficiente_total: coeficienteTotal,
        coeficiente_votante: coeficienteVotante,
        coeficiente_pendiente: coeficienteTotal - coeficienteVotante,
        porcentaje_participacion_nominal: porcentajeNominal,
        porcentaje_participacion_coeficiente: porcentajeCoeficiente,
        quorum_alcanzado: porcentajeCoeficiente >= 50
      })
    } catch (error) {
      console.error('Error loading quorum:', error)
    }
  }

  const handleActivarVotacion = async () => {
    if (!asamblea) return
    
    try {
      const baseUrl = window.location.origin
      
      const { data, error } = await supabase.rpc('activar_votacion_publica', {
        p_asamblea_id: asamblea.id,
        p_base_url: baseUrl
      })
      
      if (error) throw error
      
      setSuccessMessage('Votación pública activada exitosamente')
      loadData() // Recargar datos
    } catch (error: any) {
      console.error('Error al activar votación:', error)
      toast.error('Error al activar votación: ' + error.message)
    }
  }

  const handleDesactivarVotacion = async () => {
    if (!asamblea) return
    
    if (!confirm('¿Deseas desactivar el acceso público? Los votantes no podrán acceder con el código.')) {
      return
    }
    
    try {
      const { data, error } = await supabase.rpc('desactivar_votacion_publica', {
        p_asamblea_id: asamblea.id
      })
      
      if (error) throw error
      
      setSuccessMessage('Acceso público desactivado')
      loadData() // Recargar datos
    } catch (error: any) {
      console.error('Error al desactivar votación:', error)
      toast.error('Error al desactivar votación: ' + error.message)
    }
  }

  const handleCopiarTexto = async (texto: string, tipo: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setSuccessMessage(`${tipo} copiado al portapapeles`)
      setTimeout(() => setSuccessMessage(''), 2000)
    } catch (error) {
      console.error('Error al copiar:', error)
      toast.error('Error al copiar al portapapeles')
    }
  }

  const preguntasAbiertas = preguntas.filter((p) => p.estado === 'abierta')

  const handleAbrirRegistroVotoAdmin = async () => {
    if (!asamblea?.organization_id) return
    if (!puedeOperar) {
      setSinTokensModalOpen(true)
      return
    }
    setShowRegistroVotoAdmin(true)
    setUnidadRegistroVoto('')
    setVotanteEmailRegistro('')
    setVotanteNombreRegistro('')
    setVotosRegistroPorPregunta({})
    try {
      const { data } = await supabase
        .from('unidades')
        .select('id, torre, numero, email_propietario')
        .eq('organization_id', asamblea.organization_id)
        .order('torre')
        .order('numero')
      setUnidadesParaVoto(data ?? [])
    } catch (e) {
      console.error('Error cargando unidades:', e)
      setUnidadesParaVoto([])
    }
  }

  const handleUnidadChangeRegistro = (unidadId: string) => {
    setUnidadRegistroVoto(unidadId)
    const u = unidadesParaVoto.find((x) => x.id === unidadId)
    if (u) {
      setVotanteEmailRegistro(u.email_propietario ?? '')
      setVotanteNombreRegistro('')
    }
  }

  const handleRegistrarVotoAdmin = async () => {
    if (!asamblea || !unidadRegistroVoto || !votanteEmailRegistro.trim()) {
      toast.error('Selecciona una unidad e indica el email del residente.')
      return
    }
    const votosPayload = preguntasAbiertas
      .filter((p) => votosRegistroPorPregunta[p.id])
      .map((p) => ({ pregunta_id: p.id, opcion_id: votosRegistroPorPregunta[p.id] }))
    if (votosPayload.length === 0) {
      toast.error('Indica al menos un voto para una pregunta abierta.')
      return
    }
    setSavingRegistroVoto(true)
    try {
      const res = await fetch('/api/admin/registrar-voto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          asamblea_id: asamblea.id,
          unidad_id: unidadRegistroVoto,
          votante_email: votanteEmailRegistro.trim(),
          votante_nombre: votanteNombreRegistro.trim() || undefined,
          votos: votosPayload,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 402) {
          setShowRegistroVotoAdmin(false)
          setSinTokensModalOpen(true)
          toast.error(
            data.error ||
              `Saldo insuficiente: Necesitas ${costoOperacion} tokens para procesar ${costoOperacion} unidades.`
          )
          return
        }
        const msg = res.status === 403
          ? 'No tienes permiso para registrar votos en esta asamblea. Verifica que pertenezcas al conjunto.'
          : (data.error || 'Error al registrar votos')
        toast.error(msg)
        return
      }
      setSuccessMessage(data.message || 'Votos registrados correctamente')
      setShowRegistroVotoAdmin(false)
      loadEstadisticas()
      loadQuorum()
      loadData()
    } catch (e) {
      console.error('Error registrando votos:', e)
      toast.error('Error al registrar votos')
    } finally {
      setSavingRegistroVoto(false)
    }
  }

  const handleCompartirWhatsApp = () => {
    if (!asamblea || !asamblea.url_publica) return
    
    const mensaje = encodeURIComponent(
      `🗳️ VOTACIÓN VIRTUAL ACTIVA\n\n` +
      `📋 ${asamblea.nombre}\n` +
      `📅 ${formatFecha(asamblea.fecha)}\n\n` +
      `👉 Vota aquí:\n${asamblea.url_publica}\n\n` +
      `Código: ${asamblea.codigo_acceso}\n\n` +
      `⚠️ Necesitas tu email registrado en el conjunto\n\n` +
      `¡Tu participación es importante! 🏠`
    )
    
    window.open(`https://wa.me/?text=${mensaje}`, '_blank')
  }

  const handleCreatePregunta = async () => {
    if (!newPregunta.texto_pregunta.trim()) {
      toast.error('El texto de la pregunta es obligatorio')
      return
    }

    // Validar que haya al menos 2 opciones
    const opcionesValidas = opciones.filter(o => o.texto_opcion.trim())
    if (opcionesValidas.length < 2) {
      toast.error('Debes tener al menos 2 opciones de respuesta')
      return
    }

    setSavingPregunta(true)
    try {
      const nextOrden = preguntas.length > 0 
        ? Math.max(...preguntas.map(p => p.orden)) + 1 
        : 1

      // Crear pregunta
      const { data: pregunta, error } = await supabase
        .from('preguntas')
        .insert({
          asamblea_id: params.id,
          orden: nextOrden,
          texto_pregunta: newPregunta.texto_pregunta.trim(),
          descripcion: newPregunta.descripcion.trim() || null,
          tipo_votacion: newPregunta.tipo_votacion,
          estado: 'pendiente',
          umbral_aprobacion: newPregunta.umbral_aprobacion ?? null
        })
        .select()
        .single()

      if (error) throw error

      // Crear opciones de la pregunta
      const opcionesInsert = opcionesValidas.map((opcion, index) => ({
        pregunta_id: pregunta.id,
        texto_opcion: opcion.texto_opcion.trim(),
        orden: index + 1,
        color: opcion.color
      }))

      const { data: opcionesCreadas, error: opcionesError } = await supabase
        .from('opciones_pregunta')
        .insert(opcionesInsert)
        .select()

      if (opcionesError) throw opcionesError

      setPreguntas([...preguntas, pregunta])
      setOpcionesPreguntas({
        ...opcionesPreguntas,
        [pregunta.id]: opcionesCreadas || []
      })
      
      setShowNewPregunta(false)
      setNewPregunta({
        texto_pregunta: '',
        descripcion: '',
        tipo_votacion: 'coeficiente',
        umbral_aprobacion: null
      })
      setOpciones([
        { texto_opcion: 'A favor', orden: 1, color: '#10b981' },
        { texto_opcion: 'En contra', orden: 2, color: '#ef4444' },
        { texto_opcion: 'Me abstengo', orden: 3, color: '#6b7280' }
      ])
      
      setSuccessMessage('Pregunta agregada exitosamente')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error creating pregunta:', error)
      toast.error('Error al crear la pregunta: ' + error.message)
    } finally {
      setSavingPregunta(false)
    }
  }

  const handleDeletePregunta = async () => {
    if (!deletingPregunta) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('preguntas')
        .delete()
        .eq('id', deletingPregunta.id)

      if (error) throw error

      setPreguntas(preguntas.filter(p => p.id !== deletingPregunta.id))
      setDeletingPregunta(null)
      setSuccessMessage('Pregunta eliminada')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error deleting pregunta:', error)
      toast.error('Error al eliminar: ' + error.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleChangeEstadoPregunta = async (preguntaId: string, nuevoEstado: 'pendiente' | 'abierta' | 'cerrada') => {
    try {
      const { error } = await supabase
        .from('preguntas')
        .update({ estado: nuevoEstado })
        .eq('id', preguntaId)

      if (error) throw error

      setPreguntas(preguntas.map(p => 
        p.id === preguntaId ? { ...p, estado: nuevoEstado } : p
      ))
      
      const mensajes = {
        pendiente: 'Pregunta cerrada',
        abierta: 'Votación abierta - Los propietarios ya pueden votar',
        cerrada: 'Votación cerrada'
      }
      
      setSuccessMessage(mensajes[nuevoEstado])
      setTimeout(() => setSuccessMessage(''), 3000)

      // Recargar estadísticas
      await loadEstadisticas()
      await loadQuorum()
    } catch (error: any) {
      console.error('Error updating estado:', error)
      toast.error('Error al cambiar estado: ' + error.message)
    }
  }

  const addOpcion = () => {
    setOpciones([
      ...opciones,
      { texto_opcion: '', orden: opciones.length + 1, color: '#6366f1' }
    ])
  }

  const removeOpcion = (index: number) => {
    if (opciones.length <= 2) {
      toast.error('Debes tener al menos 2 opciones')
      return
    }
    setOpciones(opciones.filter((_, i) => i !== index))
  }

  const updateOpcion = (index: number, field: keyof OpcionPregunta, value: string | number) => {
    const newOpciones = [...opciones]
    newOpciones[index] = { ...newOpciones[index], [field]: value }
    setOpciones(newOpciones)
  }

  const updateEditOpcion = (index: number, field: keyof OpcionPregunta, value: string | number) => {
    const newOpciones = [...editOpciones]
    newOpciones[index] = { ...newOpciones[index], [field]: value }
    setEditOpciones(newOpciones)
  }

  const addEditOpcion = () => {
    setEditOpciones([
      ...editOpciones,
      { texto_opcion: '', orden: editOpciones.length + 1, color: '#6366f1' }
    ])
  }

  const removeEditOpcion = (index: number) => {
    if (editOpciones.length <= 2) {
      toast.error('Debes tener al menos 2 opciones')
      return
    }
    setEditOpciones(editOpciones.filter((_, i) => i !== index))
  }

  const handleEditClick = async (pregunta: Pregunta) => {
    setEditingPregunta(pregunta)
    setEditForm({
      texto_pregunta: pregunta.texto_pregunta,
      descripcion: pregunta.descripcion || '',
      tipo_votacion: pregunta.tipo_votacion,
      umbral_aprobacion: (pregunta as Pregunta & { umbral_aprobacion?: number | null }).umbral_aprobacion ?? null
    })

    // Cargar opciones actuales (solo editables si la pregunta está pendiente)
    const opcionesActuales = opcionesPreguntas[pregunta.id] || []
    setEditOpciones(opcionesActuales.map(op => ({
      id: op.id,
      texto_opcion: op.texto_opcion,
      orden: op.orden,
      color: op.color
    })))
  }

  const handleSaveEdit = async () => {
    if (!editingPregunta) return

    if (!editForm.texto_pregunta.trim()) {
      toast.error('El texto de la pregunta es obligatorio')
      return
    }

    const esSoloTexto = editingPregunta.estado === 'abierta' || editingPregunta.estado === 'cerrada'
    const opcionesValidas = editOpciones.filter(o => o.texto_opcion.trim())
    if (!esSoloTexto && opcionesValidas.length < 2) {
      toast.error('Debes tener al menos 2 opciones de respuesta')
      return
    }

    setSavingEdit(true)
    try {
      // Siempre permitir actualizar texto y descripción (incluso si la pregunta está abierta o cerrada)
      const { error: updateError } = await supabase
        .from('preguntas')
        .update({
          texto_pregunta: editForm.texto_pregunta.trim(),
          descripcion: editForm.descripcion.trim() || null,
          ...(esSoloTexto ? {} : {
            tipo_votacion: editForm.tipo_votacion,
            umbral_aprobacion: editForm.umbral_aprobacion ?? null
          })
        })
        .eq('id', editingPregunta.id)

      if (updateError) throw updateError

      if (esSoloTexto) {
        setPreguntas(prev => prev.map(p => p.id === editingPregunta.id
          ? { ...p, texto_pregunta: editForm.texto_pregunta.trim(), descripcion: editForm.descripcion.trim() || '' }
          : p))
        setEditingPregunta(null)
        setSavingEdit(false)
        toast.success('Texto de la pregunta actualizado. Se verá el cambio en la página de acceso.')
        return
      }

      // Eliminar opciones anteriores (solo cuando la pregunta está pendiente)
      const { error: deleteError } = await supabase
        .from('opciones_pregunta')
        .delete()
        .eq('pregunta_id', editingPregunta.id)

      if (deleteError) throw deleteError

      // Insertar nuevas opciones
      const opcionesInsert = opcionesValidas.map((opcion, index) => ({
        pregunta_id: editingPregunta.id,
        texto_opcion: opcion.texto_opcion.trim(),
        orden: index + 1,
        color: opcion.color
      }))

      const { data: opcionesCreadas, error: opcionesError } = await supabase
        .from('opciones_pregunta')
        .insert(opcionesInsert)
        .select()

      if (opcionesError) throw opcionesError

      // Actualizar estado local
      setPreguntas(preguntas.map(p =>
        p.id === editingPregunta.id
          ? { ...p, ...editForm }
          : p
      ))

      setOpcionesPreguntas({
        ...opcionesPreguntas,
        [editingPregunta.id]: opcionesCreadas || []
      })

      setEditingPregunta(null)
      setSuccessMessage('Pregunta actualizada exitosamente')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error updating pregunta:', error)
      toast.error('Error al actualizar la pregunta: ' + error.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const getEstadoPreguntaBadge = (estado: string) => {
    const badges = {
      pendiente: { icon: Clock, text: 'Pendiente', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
      abierta: { icon: Play, text: 'Abierta', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      cerrada: { icon: CheckCircle2, text: 'Cerrada', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
    }
    const badge = badges[estado as keyof typeof badges]
    const Icon = badge.icon
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.className}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    )
  }

  const handleChangeEstadoAsamblea = async (nuevoEstado: 'borrador' | 'activa' | 'finalizada') => {
    if (!asamblea) return

    if (nuevoEstado === 'activa') {
      const yaPagada = asamblea.pago_realizado === true
      if (!yaPagada && (!puedeOperar || (costoOperacion > 0 && tokensDisponibles < costoOperacion))) {
        setSinTokensModalOpen(true)
        toast.error('Saldo insuficiente para esta operación.')
        return
      }
      try {
        const res = await fetch('/api/dashboard/descontar-token-asamblea-pro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ asamblea_id: asamblea.id }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.status === 402) {
          setSinTokensModalOpen(true)
          return
        }
        if (res.status === 403) {
          toast.error('No tienes permiso para este conjunto. No es un tema de tokens.')
          return
        }
        if (!res.ok) {
          const msg = res.status === 402
            ? (data.error ?? `Saldo insuficiente: Necesitas ${costoOperacion} tokens y tienes ${tokensDisponibles}.`)
            : (data.error || 'Error al activar asamblea')
          toast.error(msg)
          return
        }
        if (data.tokens_restantes != null) setTokensDisponibles(Math.max(0, Number(data.tokens_restantes)))
        if (data.pago_realizado === true) setAsamblea((prev) => (prev ? { ...prev, pago_realizado: true } : null))
      } catch (e) {
        console.error('Descontar token:', e)
        toast.error(
          `Saldo insuficiente: Necesitas ${costoOperacion} tokens para procesar ${costoOperacion} unidades.`
        )
        return
      }
    }

    try {
      const { error } = await supabase
        .from('asambleas')
        .update({ estado: nuevoEstado })
        .eq('id', asamblea.id)

      if (error) throw error

      setAsamblea({ ...asamblea, estado: nuevoEstado })
      setSuccessMessage(`Asamblea ${nuevoEstado === 'activa' ? 'activada' : 'actualizada'}`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error updating estado:', error)
      toast.error('Error al cambiar estado: ' + error.message)
    }
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstadoBadge = (estado: string) => {
    const badges = {
      borrador: { 
        icon: Edit, 
        text: 'Borrador', 
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
      },
      activa: { 
        icon: CheckCircle2, 
        text: 'Activa', 
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      },
      finalizada: { 
        icon: Clock, 
        text: 'Finalizada', 
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      }
    }
    const badge = badges[estado as keyof typeof badges]
    const Icon = badge.icon
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando asamblea...</p>
        </div>
      </div>
    )
  }

  if (!asamblea) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Asambleas', href: '/dashboard/asambleas' },
              { label: asamblea.nombre }
            ]}
            className="mb-2"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/asambleas"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {asamblea.nombre}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-3">
              {/* Billetera de tokens — visible en todas las páginas de administrador */}
              <div className="flex items-center gap-2 rounded-3xl bg-slate-100 dark:bg-slate-700/50 px-3 py-2 border border-slate-200 dark:border-slate-600">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Billetera:</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tokensDisponibles} tokens</span>
                {costoOperacion > 0 && !asamblea.pago_realizado && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">(costo asamblea: {costoOperacion})</span>
                )}
              </div>
              {asamblea.pago_realizado && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Asamblea Pagada / Acceso Total
                </span>
              )}
              {getEstadoBadge(asamblea.estado)}
              {asamblea.estado === 'borrador' && (
                (puedeOperar || asamblea.pago_realizado) ? (
                  <div className="flex flex-col gap-1">
                    {!asamblea.pago_realizado && costoOperacion > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Activar consumirá {costoOperacion} tokens (cobro único por asamblea). Saldo: {tokensDisponibles}.
                      </p>
                    )}
                    <Button
                      onClick={() => handleChangeEstadoAsamblea('activa')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activar
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setSinTokensModalOpen(true)}
                    variant="outline"
                    disabled
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 cursor-not-allowed"
                    title="Saldo insuficiente para esta operación"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Activar (saldo insuficiente)
                  </Button>
                )
              )}
              {(asamblea.estado === 'finalizada' || asamblea.estado === 'activa' || preguntas.some(p => p.estado === 'cerrada')) && (
                (puedeOperar || asamblea.pago_realizado) ? (
                  <div className="flex flex-col gap-1">
                    {!asamblea.pago_realizado && costoOperacion > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Generar acta consumirá {costoOperacion} tokens (cobro único). Saldo: {tokensDisponibles}.
                      </p>
                    )}
                    <Link href={`/dashboard/asambleas/${params.id}/acta`}>
                      <Button variant="outline" className="border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400">
                        <FileText className="w-4 h-4 mr-2" />
                        {preguntas.some(p => p.estado === 'cerrada') ? 'Descargar acta (todas las preguntas y votos)' : 'Generar acta'}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 cursor-not-allowed"
                    title="Saldo insuficiente para esta operación"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Acta (saldo insuficiente)
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {successMessage && (
          <Alert className="mb-6 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Panel de Quórum */}
        <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border-2 border-indigo-200 dark:border-indigo-800">
          {quorum ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                  <Users className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Quórum y Participación
                </h3>
                {quorum.quorum_alcanzado && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-semibold flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Quórum Alcanzado
                  </span>
                )}
              </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Participación Nominal */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Unidades Votantes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {quorum.unidades_votantes}/{quorum.total_unidades}
                </p>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${quorum.porcentaje_participacion_nominal}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {quorum.porcentaje_participacion_nominal}% participación
                </p>
              </div>

              {/* Participación por Coeficiente */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Coeficiente Votante (Ley 675)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {quorum.coeficiente_votante.toFixed(2)}%
                </p>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      quorum.quorum_alcanzado
                        ? 'bg-green-600 dark:bg-green-500'
                        : 'bg-orange-600 dark:bg-orange-500'
                    }`}
                    style={{ width: `${quorum.porcentaje_participacion_coeficiente}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {quorum.porcentaje_participacion_coeficiente}% del total
                </p>
              </div>

              {/* Unidades Pendientes */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pendientes de Votar</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {quorum.unidades_pendientes}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Coeficiente pendiente: {quorum.coeficiente_pendiente.toFixed(2)}%
                </p>
                {!quorum.quorum_alcanzado && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                    ⚠️ Se requiere más del 50% para quórum
                  </p>
                )}
              </div>
            </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                ⏱️ Datos actualizados en tiempo real cada 5 segundos
              </p>
            </>
            ) : (
              <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
              <p className="text-gray-600 dark:text-gray-400">Cargando datos de participación...</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {preguntas.length === 0 && 'Crea preguntas y ábrelas para ver el quórum'}
              </p>
            </div>
          )}
        </div>

        {/* Registrar voto a nombre de un residente (p. ej. personas mayores) — requiere tokens */}
        {preguntasAbiertas.length > 0 && (
          <div className="mb-6 flex justify-end">
            {puedeOperar ? (
              <div className="flex flex-col gap-1 items-end">
                {costoOperacion > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Esta operación consumirá {costoOperacion} tokens. Saldo actual: {tokensDisponibles}.
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={handleAbrirRegistroVotoAdmin}
                  className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  title="Registrar el voto de un residente que no puede votar en línea (p. ej. persona mayor)"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrar voto a nombre de un residente
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                disabled
                className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 cursor-not-allowed"
                title="Saldo insuficiente para esta operación"
              >
                <Lock className="w-4 h-4 mr-2" />
                Registrar voto (saldo insuficiente)
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Billetera + Información + Acceso */}
          <div className="lg:col-span-1 space-y-6">
            {/* Billetera de tokens — siempre visible en detalle de asamblea */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1M11 14l2 2 4-4" />
                </svg>
                Billetera de tokens
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Saldo:</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {tokensDisponibles} tokens
                  </span>
                </div>
                {costoOperacion > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Costo por operación (activar, acta, registro manual): <strong>{costoOperacion} tokens</strong>
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full ${costoOperacion > 0 && tokensDisponibles < costoOperacion ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400' : ''}`}
                  onClick={() => setSinTokensModalOpen(true)}
                  title="Comprar más tokens para tu billetera"
                >
                  Comprar tokens
                </Button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Información
              </h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha y Hora</p>
                  <div className="flex items-center text-sm text-gray-900 dark:text-white">
                    <Calendar className="w-4 h-4 mr-2 text-indigo-600" />
                    {formatFecha(asamblea.fecha)}
                  </div>
                </div>

                {asamblea.descripcion && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Descripción</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {asamblea.descripcion}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estado</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {asamblea.estado}
                  </p>
                </div>
              </div>

              {/* Botón de Gestión de Poderes */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href={`/dashboard/asambleas/${params.id}/poderes`}
                  className="block w-full"
                >
                  <Button
                    variant="outline"
                    className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 border-purple-200 dark:border-purple-800"
                  >
                    <Users className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                    <span className="text-purple-900 dark:text-purple-100 font-semibold">
                      Gestión de Poderes
                    </span>
                  </Button>
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Administra quién vota en representación de otros
                </p>
              </div>

              {/* Panel de Código de Acceso y URL */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Acceso Público
                </h3>

                {!asamblea.acceso_publico ? (
                  <div className="space-y-3">
                    <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-xs">
                        La votación pública no está activada. Los residentes no podrán acceder a votar.
                      </AlertDescription>
                    </Alert>
                    <Button
                      onClick={handleActivarVotacion}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <Unlock className="w-4 h-4 mr-2" />
                      Activar Votación Pública
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Esto generará un código único para compartir
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Código de Acceso */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-3xl p-4 border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-green-800 dark:text-green-200">
                          Código de Acceso
                        </p>
                        <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                          ✓ Activo
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={asamblea.codigo_acceso || ''}
                          readOnly
                          className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 font-mono text-lg font-bold text-center text-gray-900 dark:text-white"
                        />
                        <Button
                          onClick={() => handleCopiarTexto(asamblea.codigo_acceso || '', 'Código')}
                          variant="outline"
                          size="sm"
                          className="border-green-300 dark:border-green-700"
                          title="Copiar el código de acceso al portapapeles"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* URL para Compartir */}
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Enlace de Votación
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={asamblea.url_publica || ''}
                          readOnly
                          className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-xs text-gray-700 dark:text-gray-300"
                        />
                        <Button
                          onClick={() => handleCopiarTexto(asamblea.url_publica || '', 'URL')}
                          variant="outline"
                          size="sm"
                          title="Copiar el enlace de votación al portapapeles"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={handleCompartirWhatsApp}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                        size="sm"
                        title="Compartir el enlace de votación por WhatsApp"
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        WhatsApp
                      </Button>
                      <Link href={`/dashboard/asambleas/${params.id}/acceso`} className="w-full" title="Ver código QR para que los residentes escaneen y voten">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          title="Ver código QR para compartir"
                        >
                          <QrCode className="w-4 h-4 mr-1" />
                          Ver QR
                        </Button>
                      </Link>
                    </div>
                    
                    <Button
                      onClick={handleDesactivarVotacion}
                      variant="outline"
                      size="sm"
                      className="w-full border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Lock className="w-4 h-4 mr-1" />
                      Desactivar Votación
                    </Button>

                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Comparte este código con los residentes para que puedan votar
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preguntas */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Preguntas de Votación
                </h2>
                {preguntas.length < planLimits.max_preguntas_por_asamblea && (
                <Button
                  onClick={() => setShowNewPregunta(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  title="Añadir una nueva pregunta de votación a esta asamblea"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Pregunta
                </Button>
                )}
              </div>

              {preguntas.length >= planLimits.max_preguntas_por_asamblea && (
                <Alert className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-900 dark:text-amber-100">
                    Límite por saldo de tokens
                  </AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Con tu saldo actual de tokens puedes tener hasta {planLimits.max_preguntas_por_asamblea} pregunta{planLimits.max_preguntas_por_asamblea !== 1 ? 's' : ''} por asamblea. Compra más créditos (tokens) para crear más preguntas.
                    {process.env.NEXT_PUBLIC_PLAN_PRO_URL && (
                      <a
                        href={process.env.NEXT_PUBLIC_PLAN_PRO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-2 font-medium underline"
                      >
                        Ver planes y contacto
                      </a>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {preguntas.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No hay preguntas creadas
                  </p>
                  {preguntas.length < planLimits.max_preguntas_por_asamblea && (
                    <Button
                      onClick={() => setShowNewPregunta(true)}
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Primera Pregunta
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mensaje informativo sobre edición */}
                  <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-900 dark:text-blue-100">
                      ℹ️ Acerca de la edición de preguntas
                    </AlertTitle>
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                      • Solo puedes <strong>editar</strong> preguntas en estado <strong>&quot;Pendiente&quot;</strong> (sin votos registrados)
                      <br />
                      • Una vez que abras la votación, la pregunta no podrá ser modificada
                      <br />
                      • Busca el botón <Edit className="w-3 h-3 inline mx-1" /> <strong>Editar</strong> al lado de cada pregunta pendiente
                    </AlertDescription>
                  </Alert>

                  {preguntas.map((pregunta, index) => (
                    <div
                      key={pregunta.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-3xl p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                    >
                      {/* Header de la pregunta */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              #{index + 1}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded capitalize">
                              {pregunta.tipo_votacion}
                            </span>
                            {getEstadoPreguntaBadge(pregunta.estado)}
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {pregunta.texto_pregunta}
                          </h3>
                          {pregunta.descripcion && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {pregunta.descripcion}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(pregunta)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1"
                            title={pregunta.estado === 'pendiente' ? 'Editar pregunta completa' : 'Editar texto (se actualiza en acceso)'}
                          >
                            <Edit className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs">
                              {pregunta.estado === 'pendiente' ? 'Editar' : 'Editar texto'}
                            </span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingPregunta(pregunta)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            disabled={pregunta.estado === 'abierta'}
                            title={pregunta.estado === 'abierta' ? 'No puedes eliminar una pregunta abierta' : 'Eliminar pregunta'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Opciones de respuesta y estadísticas */}
                      {opcionesPreguntas[pregunta.id] && opcionesPreguntas[pregunta.id].length > 0 && (
                        <div className="mb-3">
                          {/* Si la pregunta está pendiente, solo mostrar opciones */}
                          {pregunta.estado === 'pendiente' && (
                            <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Opciones de respuesta:</p>
                              <div className="space-y-1">
                                {opcionesPreguntas[pregunta.id].map((opcion) => (
                                  <div key={opcion.id} className="flex items-center space-x-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: opcion.color }}
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                      {opcion.texto_opcion}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Si está abierta o cerrada, mostrar estadísticas */}
                          {(pregunta.estado === 'abierta' || pregunta.estado === 'cerrada') && estadisticas[pregunta.id] && (
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-4 border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  📊 Resultados en tiempo real
                                </p>
                                {pregunta.estado === 'abierta' && (
                                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                                    En vivo
                                  </span>
                                )}
                              </div>
                              <div className="space-y-3">
                                {estadisticas[pregunta.id].map((stat) => (
                                  <div key={stat.opcion_id}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center space-x-2">
                                        <div
                                          className="w-3 h-3 rounded-full"
                                          style={{ backgroundColor: stat.color }}
                                        />
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          {stat.texto_opcion}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        {pregunta.tipo_votacion === 'coeficiente' ? (
                                          <div>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                              {stat.porcentaje_coeficiente}%
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                              ({stat.votos_count} votos)
                                            </span>
                                          </div>
                                        ) : (
                                          <div>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                              {stat.votos_count} votos
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                              ({stat.porcentaje_nominal}%)
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                      <div
                                        className="h-2 rounded-full transition-all duration-500"
                                        style={{
                                          backgroundColor: stat.color,
                                          width: `${
                                            pregunta.tipo_votacion === 'coeficiente'
                                              ? stat.porcentaje_coeficiente
                                              : stat.porcentaje_nominal
                                          }%`
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {pregunta.umbral_aprobacion != null && estadisticas[pregunta.id]?.length > 0 && (() => {
                                const maxPct = Math.max(...estadisticas[pregunta.id].map(s =>
                                  pregunta.tipo_votacion === 'coeficiente' ? s.porcentaje_coeficiente : s.porcentaje_nominal
                                ))
                                const aprobado = maxPct >= (pregunta.umbral_aprobacion ?? 0)
                                return (
                                  <div className={`mt-3 py-2 px-3 rounded-lg text-center text-sm font-semibold ${aprobado ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                    Mayoría necesaria ({pregunta.umbral_aprobacion}%) — Resultado: {aprobado ? 'Aprobado' : 'No aprobado'} (máx. {maxPct.toFixed(1)}%)
                                  </div>
                                )
                              })()}
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                                {pregunta.tipo_votacion === 'coeficiente'
                                  ? '📊 Votación ponderada por coeficiente (Ley 675)'
                                  : '📊 Votación nominal (un voto por unidad)'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Controles de estado */}
                      <div className="flex items-center space-x-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        {pregunta.estado === 'pendiente' && (
                          <Button
                            size="sm"
                            onClick={() => handleChangeEstadoPregunta(pregunta.id, 'abierta')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Abrir Votación
                          </Button>
                        )}
                        {pregunta.estado === 'abierta' && (
                          <Button
                            size="sm"
                            onClick={() => handleChangeEstadoPregunta(pregunta.id, 'cerrada')}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cerrar Votación
                          </Button>
                        )}
                        {pregunta.estado === 'cerrada' && (
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleChangeEstadoPregunta(pregunta.id, 'abierta')}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Reabrir
                            </Button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              • Votación finalizada
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Dialog: Nueva Pregunta */}
      <Dialog open={showNewPregunta} onOpenChange={setShowNewPregunta}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Agregar Pregunta</DialogTitle>
            <DialogDescription>
              Crea una nueva pregunta para la asamblea
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="texto_pregunta">
                Texto de la Pregunta <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="texto_pregunta"
                value={newPregunta.texto_pregunta}
                onChange={(e) => setNewPregunta({ ...newPregunta, texto_pregunta: e.target.value })}
                placeholder="¿Aprueban el presupuesto para el año 2026?"
                className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="descripcion">Descripción (Opcional)</Label>
              <Input
                id="descripcion"
                value={newPregunta.descripcion}
                onChange={(e) => setNewPregunta({ ...newPregunta, descripcion: e.target.value })}
                placeholder="Contexto adicional..."
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="tipo_votacion">Tipo de Votación</Label>
              <Select
                id="tipo_votacion"
                value={newPregunta.tipo_votacion}
                onChange={(e) => setNewPregunta({ ...newPregunta, tipo_votacion: e.target.value as 'coeficiente' | 'nominal' })}
                className="mt-2"
              >
                <option value="coeficiente">Por Coeficiente (Ponderado)</option>
                <option value="nominal">Nominal (Un voto por unidad)</option>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {newPregunta.tipo_votacion === 'coeficiente' 
                  ? 'El voto se calcula según el coeficiente de cada unidad (Ley 675)'
                  : 'Cada unidad tiene un voto con el mismo peso'}
              </p>
            </div>

            <div>
              <Label htmlFor="umbral_aprobacion">Umbral de aprobación (%) — opcional</Label>
              <Input
                id="umbral_aprobacion"
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="Ej: 50, 70, 100. Vacío = no mostrar Aprobado/No aprobado"
                value={newPregunta.umbral_aprobacion ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  setNewPregunta({ ...newPregunta, umbral_aprobacion: v === '' ? null : Math.min(100, Math.max(0, parseFloat(v) || 0)) })
                }}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                50 = mayoría simple, 70 = calificada (ej. reforma estatutos), 100 = unanimidad.
              </p>
            </div>

            {/* Opciones de Respuesta */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>Opciones de Respuesta <span className="text-red-500">*</span></Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addOpcion}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Agregar Opción
                </Button>
              </div>
              
              <div className="space-y-2">
                {opciones.map((opcion, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={opcion.texto_opcion}
                      onChange={(e) => updateOpcion(index, 'texto_opcion', e.target.value)}
                      placeholder={`Opción ${index + 1}`}
                      className="flex-1"
                    />
                    <input
                      type="color"
                      value={opcion.color}
                      onChange={(e) => updateOpcion(index, 'color', e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      title="Color de la opción"
                    />
                    {opciones.length > 2 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeOpcion(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Mínimo 2 opciones. Puedes personalizar los textos y colores.
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewPregunta(false)
                  setOpciones([
                    { texto_opcion: 'A favor', orden: 1, color: '#10b981' },
                    { texto_opcion: 'En contra', orden: 2, color: '#ef4444' },
                    { texto_opcion: 'Me abstengo', orden: 3, color: '#6b7280' }
                  ])
                }}
                disabled={savingPregunta}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreatePregunta}
                disabled={savingPregunta}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {savingPregunta ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Pregunta
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Pregunta */}
      <Dialog open={editingPregunta !== null} onOpenChange={() => setEditingPregunta(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar Pregunta</DialogTitle>
            <DialogDescription>
              {editingPregunta && (editingPregunta.estado === 'abierta' || editingPregunta.estado === 'cerrada')
                ? 'Puedes editar solo el texto y la descripción. El cambio se verá en la página de acceso.'
                : 'Modifica los datos de la pregunta.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-texto_pregunta">
                Texto de la Pregunta <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="edit-texto_pregunta"
                value={editForm.texto_pregunta}
                onChange={(e) => setEditForm({ ...editForm, texto_pregunta: e.target.value })}
                placeholder="¿Aprueban el presupuesto para el año 2026?"
                className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit-descripcion">Descripción (Opcional)</Label>
              <Input
                id="edit-descripcion"
                value={editForm.descripcion}
                onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                placeholder="Contexto adicional..."
                className="mt-2"
              />
            </div>

            {editingPregunta && editingPregunta.estado === 'pendiente' && (
            <>
            <div>
              <Label htmlFor="edit-tipo_votacion">Tipo de Votación</Label>
              <Select
                id="edit-tipo_votacion"
                value={editForm.tipo_votacion}
                onChange={(e) => setEditForm({ ...editForm, tipo_votacion: e.target.value as 'coeficiente' | 'nominal' })}
                className="mt-2"
              >
                <option value="coeficiente">Por Coeficiente (Ponderado)</option>
                <option value="nominal">Nominal (Un voto por unidad)</option>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {editForm.tipo_votacion === 'coeficiente' 
                  ? 'El voto se calcula según el coeficiente de cada unidad (Ley 675)'
                  : 'Cada unidad tiene un voto con el mismo peso'}
              </p>
            </div>

            <div>
              <Label htmlFor="edit-umbral_aprobacion">Umbral de aprobación (%) — opcional</Label>
              <Input
                id="edit-umbral_aprobacion"
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="Ej: 50, 70, 100. Vacío = no mostrar Aprobado/No aprobado"
                value={editForm.umbral_aprobacion ?? ''}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  setEditForm({ ...editForm, umbral_aprobacion: v === '' ? null : Math.min(100, Math.max(0, parseFloat(v) || 0)) })
                }}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                50 = mayoría simple, 70 = calificada (ej. reforma estatutos), 100 = unanimidad.
              </p>
            </div>

            {/* Opciones de Respuesta */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>Opciones de Respuesta <span className="text-red-500">*</span></Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addEditOpcion}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Agregar Opción
                </Button>
              </div>
              
              <div className="space-y-2">
                {editOpciones.map((opcion, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={opcion.texto_opcion}
                      onChange={(e) => updateEditOpcion(index, 'texto_opcion', e.target.value)}
                      placeholder={`Opción ${index + 1}`}
                      className="flex-1"
                    />
                    <input
                      type="color"
                      value={opcion.color}
                      onChange={(e) => updateEditOpcion(index, 'color', e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      title="Color de la opción"
                    />
                    {editOpciones.length > 2 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeEditOpcion(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Mínimo 2 opciones. Puedes personalizar los textos y colores.
              </p>
            </div>
            </>
            )}

            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingPregunta(null)}
                disabled={savingEdit}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {savingEdit ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Eliminar Pregunta */}
      <Dialog open={deletingPregunta !== null} onOpenChange={() => setDeletingPregunta(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>¿Eliminar pregunta?</DialogTitle>
            <DialogDescription>
              {deletingPregunta?.texto_pregunta}
            </DialogDescription>
          </DialogHeader>

          <Alert variant="warning" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Advertencia</AlertTitle>
            <AlertDescription>
              Esta acción no se puede deshacer. La pregunta y sus votos serán eliminados permanentemente.
            </AlertDescription>
          </Alert>

          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingPregunta(null)}
              disabled={deleting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePregunta}
              disabled={deleting}
              className="flex-1"
            >
              {deleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar voto a nombre de un residente */}
      <Dialog open={showRegistroVotoAdmin} onOpenChange={setShowRegistroVotoAdmin}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Registrar voto a nombre de un residente
            </DialogTitle>
            <DialogDescription>
              Para personas que no pueden votar en línea (p. ej. mayores de edad sin acceso a tecnología). Los votos quedarán registrados con trazabilidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Unidad (propietario o residente)</Label>
              <select
                value={unidadRegistroVoto}
                onChange={(e) => handleUnidadChangeRegistro(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              >
                <option value="">Selecciona una unidad</option>
                {unidadesParaVoto.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.torre} - {u.numero}
                    {u.email_propietario ? ` (${u.email_propietario})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-300">Email del residente</Label>
              <Input
                type="email"
                value={votanteEmailRegistro}
                onChange={(e) => setVotanteEmailRegistro(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-300">Nombre del residente (opcional)</Label>
              <Input
                type="text"
                value={votanteNombreRegistro}
                onChange={(e) => setVotanteNombreRegistro(e.target.value)}
                placeholder="Nombre del propietario o residente"
                className="mt-1"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">Votos por pregunta abierta</p>
              {preguntasAbiertas.length === 0 ? (
                <p className="text-sm text-gray-500">No hay preguntas con votación abierta.</p>
              ) : (
                <div className="space-y-3">
                  {preguntasAbiertas.map((p) => {
                    const opciones = opcionesPreguntas[p.id] ?? []
                    return (
                      <div key={p.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-3">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">
                          {p.texto_pregunta}
                        </p>
                        <select
                          value={votosRegistroPorPregunta[p.id] ?? ''}
                          onChange={(e) =>
                            setVotosRegistroPorPregunta((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
                        >
                          <option value="">Selecciona opción</option>
                          {opciones.filter((o) => o.id).map((o) => (
                            <option key={o.id!} value={o.id}>
                              {o.texto_opcion}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowRegistroVotoAdmin(false)}
                disabled={savingRegistroVoto}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRegistrarVotoAdmin}
                disabled={savingRegistroVoto || !unidadRegistroVoto || !votanteEmailRegistro.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {savingRegistroVoto ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Registrar votos
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Sin tokens al activar / generar acta — CTA usa checkout API (monto recalculado en backend) */}
      <Dialog open={sinTokensModalOpen} onOpenChange={setSinTokensModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-amber-800 dark:text-amber-200">¡Ups! Te faltan tokens para iniciar esta asamblea</DialogTitle>
            <DialogDescription>
              Esta asamblea requiere <strong>{costoOperacion} tokens</strong>. Tu saldo actual es <strong>{tokensDisponibles}</strong>. Compra los tokens necesarios para activar la votación o generar el acta.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            {process.env.NEXT_PUBLIC_PASARELA_PAGOS_URL && userId ? (
              <button
                type="button"
                disabled={checkoutLoadingSinTokens}
                onClick={async () => {
                  setCheckoutLoadingSinTokens(true)
                  try {
                    const res = await fetch('/api/pagos/checkout-url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_id: userId,
                        conjunto_id: asamblea?.organization_id ?? undefined,
                        cantidad_tokens: Math.max(1, costoOperacion),
                      }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok && data?.url) {
                      window.open(data.url, '_blank', 'noopener,noreferrer')
                      setSinTokensModalOpen(false)
                    } else {
                      toast.error(data?.error ?? 'Error al generar enlace de pago')
                    }
                  } catch {
                    toast.error('Error al generar enlace de pago')
                  } finally {
                    setCheckoutLoadingSinTokens(false)
                  }
                }}
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-3xl text-white text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-70 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {checkoutLoadingSinTokens ? 'Generando enlace...' : `Comprar ${costoOperacion} tokens ahora`}
              </button>
            ) : whatsappNumber ? (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, quiero recargar ${Math.max(1, costoOperacion)} tokens para mi asamblea.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSinTokensModalOpen(false)}
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-3xl text-white text-base font-semibold hover:opacity-90 transition-opacity bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                Comprar {costoOperacion} tokens ahora
              </a>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-3xl bg-slate-200 dark:bg-slate-700 text-slate-500 text-base font-semibold cursor-not-allowed">
                Configura la pasarela o WhatsApp en Ajustes para comprar
              </span>
            )}
            <Button type="button" variant="outline" onClick={() => setSinTokensModalOpen(false)} className="w-full">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
