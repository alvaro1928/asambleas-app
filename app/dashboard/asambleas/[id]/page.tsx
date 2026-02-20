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
  UserPlus,
  Building2,
  HelpCircle,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail
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

/** URL canónica del sitio para enlaces de votación (WhatsApp, correo, copiar). Ver https://www.asamblea.online */
const SITE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL)
  ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  : 'https://www.asamblea.online'
import { StickyBanner } from '@/components/StickyBanner'
import { GuiaTokensModal } from '@/components/GuiaTokensModal'

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
  /** Asamblea de simulación: no consume créditos; reversible y reiniciable */
  is_demo?: boolean
  /** Timestamp de activación; ventana de gracia 3 días para ajustes */
  activated_at?: string | null
}

interface Pregunta {
  id: string
  orden: number
  texto_pregunta: string
  descripcion?: string
  tipo_votacion: 'coeficiente' | 'nominal'
  estado: 'pendiente' | 'abierta' | 'cerrada'
  umbral_aprobacion?: number | null
  is_archived?: boolean
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
  const [cantidadCompraSinTokens, setCantidadCompraSinTokens] = useState(20)
  const [guiaModalOpen, setGuiaModalOpen] = useState(false)
  const [checkoutLoadingSinTokens, setCheckoutLoadingSinTokens] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const MIN_TOKENS_COMPRA = 20

  // Al abrir el modal de sin tokens, prellenar cantidad sugerida (necesaria para esta asamblea o 20)
  useEffect(() => {
    if (sinTokensModalOpen) setCantidadCompraSinTokens(Math.max(MIN_TOKENS_COMPRA, costoOperacion))
  }, [sinTokensModalOpen])

  // Preguntas archivadas: sección colapsable
  const [showPreguntasArchivadas, setShowPreguntasArchivadas] = useState(false)
  const [archivingPreguntaId, setArchivingPreguntaId] = useState<string | null>(null)
  // Modales ciclo de vida
  const [showModalAsambleaActivada, setShowModalAsambleaActivada] = useState(false)
  const [showModalConfirmarFinalizar, setShowModalConfirmarFinalizar] = useState(false)
  const [showModalConfirmarReiniciarDemo, setShowModalConfirmarReiniciarDemo] = useState(false)
  const [showModalConfirmarReabrir, setShowModalConfirmarReabrir] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [reiniciandoDemo, setReiniciandoDemo] = useState(false)
  const [reabriendo, setReabriendo] = useState(false)

  // Registrar voto a nombre de un residente (admin)
  const [showRegistroVotoAdmin, setShowRegistroVotoAdmin] = useState(false)
  const [unidadesParaVoto, setUnidadesParaVoto] = useState<Array<{ id: string; torre: string; numero: string; email?: string | null; email_propietario?: string | null; nombre_propietario?: string | null }>>([])
  const [unidadRegistroVoto, setUnidadRegistroVoto] = useState('')
  const [votanteEmailRegistro, setVotanteEmailRegistro] = useState('')
  const [votanteNombreRegistro, setVotanteNombreRegistro] = useState('')
  const [votosRegistroPorPregunta, setVotosRegistroPorPregunta] = useState<Record<string, string>>({})
  const [savingRegistroVoto, setSavingRegistroVoto] = useState(false)

  // Enviar enlace a cada unidad (WhatsApp o correo por separado)
  const [showModalEnviarEnlace, setShowModalEnviarEnlace] = useState(false)
  const [unidadesParaEnvio, setUnidadesParaEnvio] = useState<Array<{ id: string; torre: string; numero: string; email_propietario?: string | null; telefono_propietario?: string | null; email?: string | null; telefono?: string | null }>>([])
  const [loadingUnidadesEnvio, setLoadingUnidadesEnvio] = useState(false)
  /** WhatsApp adicional (ej. grupo de la copropiedad no inscrito a ninguna unidad) */
  const [whatsappAdicionalEnvio, setWhatsappAdicionalEnvio] = useState('')

  const [billeteraColapsada, setBilleteraColapsada] = useState(true)

  // Edición de fecha y hora (solo borrador o activa; doble confirmación)
  const [showEditFechaModal, setShowEditFechaModal] = useState(false)
  const [editFechaValue, setEditFechaValue] = useState('')
  const [editHoraValue, setEditHoraValue] = useState('10:00')
  const [showConfirmFechaModal, setShowConfirmFechaModal] = useState(false)
  const [savingFecha, setSavingFecha] = useState(false)
  const puedeEditarFecha = asamblea && (asamblea.estado === 'borrador' || asamblea.estado === 'activa')

  // Guía de paneles (Quórum, Preguntas, Poderes)
  const [showGuiaAsambleaModal, setShowGuiaAsambleaModal] = useState(false)

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

      // Si está activa y pasaron 72 h desde activated_at, pasar automáticamente a finalizada (solo no-demo)
      const GRACE_MS_LOAD = 3 * 24 * 60 * 60 * 1000
      const activadaEn = (asambleaData as { activated_at?: string | null }).activated_at
      const esDemo = (asambleaData as { is_demo?: boolean }).is_demo === true
      if (
        (asambleaData as { estado?: string }).estado === 'activa' &&
        activadaEn &&
        !esDemo &&
        (Date.now() - new Date(activadaEn).getTime() >= GRACE_MS_LOAD)
      ) {
        const { error: updateErr } = await supabase
          .from('asambleas')
          .update({ estado: 'finalizada' })
          .eq('id', params.id)
        if (!updateErr) {
          setAsamblea({ ...asambleaData, estado: 'finalizada' } as typeof asambleaData)
          setSuccessMessage('La asamblea pasó automáticamente a finalizada (ventana de gracia de 72 h).')
          setTimeout(() => setSuccessMessage(''), 5000)
        } else {
          setAsamblea(asambleaData)
        }
      } else {
        setAsamblea(asambleaData)
      }

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

      // Cargar estadísticas y quórum (pasamos preguntas recién cargadas: setState es async y loadEstadisticas usa preguntas)
      await loadEstadisticas(preguntasData || [])
      await loadQuorum(asambleaData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEstadisticas = async (preguntasOverride?: typeof preguntas) => {
    const list = preguntasOverride ?? preguntas
    if (list.length === 0) return

    try {
      const statsMap: { [key: string]: EstadisticaOpcion[] } = {}

      for (const pregunta of list) {
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

  const loadQuorum = async (asambleaOverride?: { is_demo?: boolean } | null) => {
    try {
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) return

      // Intentar usar la función RPC (excluye unidades demo en asambleas reales)
      const { data: rpcData, error: rpcError } = await supabase.rpc('calcular_quorum_asamblea', {
        p_asamblea_id: params.id
      })

      if (!rpcError && rpcData && rpcData.length > 0) {
        setQuorum(rpcData[0])
        return
      }

      // Si falla la función RPC (no existe aún), calcular manualmente
      const isDemo = asambleaOverride?.is_demo ?? asamblea?.is_demo
      const soloUnidadesDemo = isDemo === true

      // Obtener total de unidades del conjunto (solo reales o solo demo, según la asamblea)
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, coeficiente')
        .eq('organization_id', selectedConjuntoId)
        .eq('is_demo', soloUnidadesDemo)

      const totalUnidades = unidadesData?.length || 0
      const coeficienteTotal = unidadesData?.reduce((sum, u) => sum + u.coeficiente, 0) || 0
      const idsUnidadesValidas = new Set(unidadesData?.map(u => u.id) || [])

      // Obtener unidades que han votado (solo contar votos de unidades del mismo tipo: reales o demo)
      const { data: votosData } = await supabase
        .from('votos')
        .select('unidad_id, unidades!inner(coeficiente)')
        .in('pregunta_id', preguntas.map(p => p.id))

      const votosFiltrados = (votosData || []).filter((v: any) => idsUnidadesValidas.has(v.unidad_id))
      const unidadesVotantesSet = new Set(votosFiltrados.map((v: { unidad_id: string }) => v.unidad_id))
      const unidadesVotantes = unidadesVotantesSet.size

      const mapaCoef = new Map((unidadesData || []).map(u => [u.id, u.coeficiente]))
      const coeficienteVotante = Array.from(unidadesVotantesSet).reduce((sum, uid) => sum + (mapaCoef.get(uid) ?? 0), 0)

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
      const { data, error } = await supabase.rpc('activar_votacion_publica', {
        p_asamblea_id: asamblea.id,
        p_base_url: SITE_URL
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
    // No se exigen tokens para entrar ni para registrar votos; solo al activar o generar acta
    setShowRegistroVotoAdmin(true)
    setUnidadRegistroVoto('')
    setVotanteEmailRegistro('')
    setVotanteNombreRegistro('')
    setVotosRegistroPorPregunta({})
    try {
      let query = supabase
        .from('unidades')
        .select('id, torre, numero, email, email_propietario, nombre_propietario')
        .eq('organization_id', asamblea.organization_id)
      // Asamblea real: solo unidades NO demo. Asamblea sandbox: solo unidades demo.
      if (isDemo) {
        query = query.eq('is_demo', true)
      } else {
        query = query.or('is_demo.eq.false,is_demo.is.null')
      }
      const { data } = await query.order('torre').order('numero')
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
      setVotanteEmailRegistro(u.email_propietario ?? u.email ?? '')
      setVotanteNombreRegistro(u.nombre_propietario ?? '')
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
    if (!asamblea || (!asamblea.url_publica && !asamblea.codigo_acceso)) return
    const msg = getMensajeVotacion()
    if (!msg) return
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const normalizarTelefonoWhatsApp = (tel: string): string => {
    const digits = tel.replace(/\D/g, '')
    if (digits.length === 10 && digits.startsWith('3')) return '57' + digits
    if (digits.length === 12 && digits.startsWith('57')) return digits
    return digits || ''
  }

  const openModalEnviarEnlace = async () => {
    const tieneEnlace = asamblea?.codigo_acceso || asamblea?.url_publica
    if (!asamblea?.organization_id || !tieneEnlace) return
    setShowModalEnviarEnlace(true)
    setLoadingUnidadesEnvio(true)
    try {
      const { data } = await supabase
        .from('unidades')
        .select('id, torre, numero, email_propietario, telefono_propietario, email, telefono')
        .eq('organization_id', asamblea.organization_id)
        .order('torre')
        .order('numero')
      setUnidadesParaEnvio(data ?? [])
    } catch (e) {
      console.error('Error cargando unidades para envío:', e)
      setUnidadesParaEnvio([])
    } finally {
      setLoadingUnidadesEnvio(false)
    }
  }

  const abrirWhatsAppUnidad = (telefono: string) => {
    const num = normalizarTelefonoWhatsApp(telefono)
    if (!num) return
    const msg = getMensajeVotacion()
    if (!msg) return
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const abrirCorreoUnidad = (email: string) => {
    if (!email?.trim()) return
    const msg = getMensajeVotacion()
    const subject = encodeURIComponent(`Votación: ${asamblea?.nombre ?? 'Asamblea'}`)
    const urlVotacion = asamblea?.codigo_acceso ? `${SITE_URL}/votar/${asamblea.codigo_acceso}` : (asamblea?.url_publica ?? '')
    const body = encodeURIComponent((msg || '') + '\n\nEnlace: ' + urlVotacion)
    window.open(`mailto:${email.trim()}?subject=${subject}&body=${body}`, '_blank')
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

  const handleArchivarPregunta = async (preguntaId: string) => {
    setArchivingPreguntaId(preguntaId)
    try {
      const { error } = await supabase.from('preguntas').update({ is_archived: true }).eq('id', preguntaId)
      if (error) throw error
      setPreguntas((prev) => prev.map((p) => (p.id === preguntaId ? { ...p, is_archived: true } : p)))
      toast.success('Pregunta archivada. No aparecerá en el acta final.')
      await loadEstadisticas()
      await loadQuorum()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al archivar')
    } finally {
      setArchivingPreguntaId(null)
    }
  }

  const handleDesarchivarPregunta = async (preguntaId: string) => {
    setArchivingPreguntaId(preguntaId)
    try {
      const { error } = await supabase.from('preguntas').update({ is_archived: false }).eq('id', preguntaId)
      if (error) throw error
      setPreguntas((prev) => prev.map((p) => (p.id === preguntaId ? { ...p, is_archived: false } : p)))
      toast.success('Pregunta restaurada al orden del día.')
      await loadEstadisticas()
      await loadQuorum()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al desarchivar')
    } finally {
      setArchivingPreguntaId(null)
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

    // Cobro único: solo al activar la asamblea; eso habilita generar el acta cuantas veces quiera
    if (nuevoEstado === 'activa') {
      const yaPagada = asamblea.pago_realizado === true
      if (!yaPagada && costoOperacion > 0 && tokensDisponibles < costoOperacion) {
        setSinTokensModalOpen(true)
        toast.error('Saldo insuficiente para activar la asamblea.')
        return
      }
      if (!yaPagada) {
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
            toast.error('No tienes permiso para este conjunto.')
            return
          }
          if (!res.ok) {
            toast.error(data.error ?? 'Error al activar asamblea')
            return
          }
          if (data.tokens_restantes != null) setTokensDisponibles(Math.max(0, Number(data.tokens_restantes)))
          if (data.pago_realizado === true) setAsamblea((prev) => (prev ? { ...prev, pago_realizado: true } : null))
        } catch (e) {
          console.error('Descontar token:', e)
          toast.error('Error al descontar tokens. Necesitas ' + costoOperacion + ' tokens para activar.')
          return
        }
      }
    }

    try {
      const payload: { estado: string; activated_at?: string } = { estado: nuevoEstado }
      if (nuevoEstado === 'activa') {
        payload.activated_at = new Date().toISOString()
      }
      const { error } = await supabase
        .from('asambleas')
        .update(payload)
        .eq('id', asamblea.id)

      if (error) throw error

      const updated = { ...asamblea, estado: nuevoEstado, activated_at: payload.activated_at ?? asamblea.activated_at }
      setAsamblea(updated)
      setSuccessMessage(`Asamblea ${nuevoEstado === 'activa' ? 'activada' : 'actualizada'}`)
      setTimeout(() => setSuccessMessage(''), 3000)
      if (nuevoEstado === 'activa') setShowModalAsambleaActivada(true)
    } catch (error: any) {
      console.error('Error updating estado:', error)
      toast.error('Error al cambiar estado: ' + error.message)
    }
  }

  const GRACE_MS = 3 * 24 * 60 * 60 * 1000 // 72 horas
  const withinGracePeriod = asamblea?.estado === 'activa' && asamblea.activated_at
    ? (Date.now() - new Date(asamblea.activated_at).getTime() < GRACE_MS)
    : false
  // Solo lectura cuando está finalizada (o en demo según reglas). Mientras esté activa se puede editar; al pasar 72 h se cierra automáticamente.
  const isReadOnlyStructure = asamblea
    ? (asamblea.estado === 'finalizada' || (asamblea.is_demo && asamblea.estado === 'activa' && !withinGracePeriod))
    : false
  // Acta disponible: si está activa (y se pagó o es demo) o si está finalizada (siempre se puede descargar el acta final)
  const actaDisponible = asamblea && (
    asamblea.estado === 'finalizada' ||
    (asamblea.estado === 'activa' && (asamblea.pago_realizado === true || asamblea.is_demo === true))
  )

  const handleFinalizarAsamblea = async () => {
    if (!asamblea || asamblea.is_demo) return
    setFinalizando(true)
    try {
      const { error } = await supabase.from('asambleas').update({ estado: 'finalizada' }).eq('id', asamblea.id)
      if (error) throw error
      setAsamblea({ ...asamblea, estado: 'finalizada' })
      setShowModalConfirmarFinalizar(false)
      setSuccessMessage('Asamblea finalizada. La estructura es ahora de solo lectura.')
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al finalizar')
    } finally {
      setFinalizando(false)
    }
  }

  const costoReapertura = Math.max(1, Math.ceil(costoOperacion * 0.1))
  const handleReabrirAsamblea = async () => {
    if (!asamblea || asamblea.estado !== 'finalizada' || asamblea.is_demo) return
    if (tokensDisponibles < costoReapertura) {
      setShowModalConfirmarReabrir(false)
      setSinTokensModalOpen(true)
      toast.error('Saldo insuficiente para reabrir.')
      return
    }
    setReabriendo(true)
    try {
      const res = await fetch('/api/dashboard/reabrir-asamblea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ asamblea_id: asamblea.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402) {
        setShowModalConfirmarReabrir(false)
        setSinTokensModalOpen(true)
        return
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Error al reabrir')
        return
      }
      setShowModalConfirmarReabrir(false)
      if (data.tokens_restantes != null) setTokensDisponibles(Math.max(0, Number(data.tokens_restantes)))
      setAsamblea((prev) =>
        prev ? { ...prev, estado: 'activa', activated_at: data.activated_at ?? new Date().toISOString() } : null
      )
      setSuccessMessage(`Asamblea reabierta. Se descontaron ${data.costo_reapertura ?? costoReapertura} tokens (10% del costo de activación).`)
      setTimeout(() => setSuccessMessage(''), 5000)
      loadData()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al reabrir la asamblea')
    } finally {
      setReabriendo(false)
    }
  }

  const handleReiniciarSimulacion = async () => {
    if (!asamblea?.is_demo) return
    setReiniciandoDemo(true)
    try {
      const preguntaIds = preguntas.map((p) => p.id)
      if (preguntaIds.length > 0) {
        const { error: votosError } = await supabase.from('votos').delete().in('pregunta_id', preguntaIds)
        if (votosError) throw votosError
      }
      const { error: quorumError } = await supabase.from('quorum_asamblea').delete().eq('asamblea_id', asamblea.id)
      if (quorumError) console.warn('quorum_asamblea delete:', quorumError)
      setShowModalConfirmarReiniciarDemo(false)
      toast.success('Simulación reiniciada. Los votos se han borrado; puedes votar de nuevo.')
      await loadQuorum()
      await loadEstadisticas()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al reiniciar simulación')
    } finally {
      setReiniciandoDemo(false)
    }
  }

  const openEditFechaModal = () => {
    if (!asamblea?.fecha) return
    const d = new Date(asamblea.fecha)
    setEditFechaValue(d.toISOString().slice(0, 10))
    const h = d.getHours()
    const m = d.getMinutes()
    setEditHoraValue(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    setShowEditFechaModal(true)
  }

  const handleConfirmarCambioFecha = async () => {
    if (!asamblea || !editFechaValue.trim()) return
    setSavingFecha(true)
    try {
      const hora = (editHoraValue.trim() || '10:00').slice(0, 5) // HH:mm
      const fechaHora = `${editFechaValue}T${hora}:00`
      const { error } = await supabase.from('asambleas').update({ fecha: fechaHora }).eq('id', asamblea.id)
      if (error) throw error
      setAsamblea({ ...asamblea, fecha: fechaHora })
      setShowConfirmFechaModal(false)
      setShowEditFechaModal(false)
      toast.success('Fecha actualizada')
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al actualizar la fecha')
    } finally {
      setSavingFecha(false)
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

  const getMensajeVotacion = (): string => {
    if (!asamblea) return ''
    const url = asamblea.codigo_acceso ? `${SITE_URL}/votar/${asamblea.codigo_acceso}` : (asamblea.url_publica || '')
    if (!url) return ''
    return `🗳️ VOTACIÓN VIRTUAL ACTIVA\n\n📋 ${asamblea.nombre}\n📅 ${formatFecha(asamblea.fecha)}\n\n👉 Vota aquí:\n${url}\n\n⚠️ Necesitas tu email registrado en el conjunto\n\n¡Tu participación es importante! 🏠`
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

  const isDemo = asamblea.is_demo === true

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {isDemo && <StickyBanner />}
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 min-w-0">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Asambleas', href: '/dashboard/asambleas' },
              { label: asamblea.nombre }
            ]}
            className="mb-2"
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="flex items-center space-x-4 min-w-0 shrink-0">
              <Link
                href="/dashboard/asambleas"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {asamblea.nombre}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''}
                </p>
                <p
                  className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-fit max-w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(asamblea.id)
                    toast.success('ID de asamblea copiado')
                  }}
                  title="Clic para copiar ID"
                >
                  <Copy className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[180px] sm:max-w-none">{asamblea.id}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto min-w-0">
              {/* Acceso rápido a unidades del mismo conjunto */}
              {asamblea.organization_id && (
                <Link
                  href={isReadOnlyStructure ? '#' : `/dashboard/unidades?volver_asamblea=${params.id}&conjunto_id=${asamblea.organization_id}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium transition-colors shrink-0 ${isReadOnlyStructure ? 'pointer-events-none opacity-60 text-gray-500 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  title={isReadOnlyStructure ? 'Estructura congelada (solo lectura)' : 'Ir a configurar unidades (propietarios, contacto) y volver a esta asamblea'}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Configurar unidades</span>
                  <span className="sm:hidden">Unidades</span>
                </Link>
              )}
              {/* Billetera de tokens — visible en todas las páginas de administrador */}
              <div className="flex items-center gap-2 rounded-3xl bg-slate-100 dark:bg-slate-700/50 px-3 py-2 border border-slate-200 dark:border-slate-600">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Billetera:</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tokensDisponibles} tokens</span>
                {costoOperacion > 0 && !asamblea.pago_realizado && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">(costo asamblea: {costoOperacion})</span>
                )}
              </div>
              {asamblea.pago_realizado && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 shrink-0" title="Asamblea Pagada / Acceso Total">
                  <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />
                  <span className="hidden sm:inline">Asamblea Pagada / Acceso Total</span>
                  <span className="sm:hidden">Pagada</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setGuiaModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                title="Guía: tokens y funcionalidades"
              >
                <HelpCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="hidden sm:inline">Guía tokens</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGuiaAsambleaModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                title="Qué hace cada panel: Quórum, Preguntas, Poderes"
              >
                <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="hidden sm:inline">Guía paneles</span>
              </button>
              {getEstadoBadge(asamblea.estado)}
              {asamblea.estado === 'borrador' && (
                (puedeOperar || asamblea.pago_realizado) ? (
                  <div className="flex flex-col gap-1">
                    {!asamblea.pago_realizado && costoOperacion > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Al activar se cobran {costoOperacion} tokens (una sola vez); después podrás generar el acta cuantas veces quieras. Saldo: {tokensDisponibles}.
                      </p>
                    )}
                    <Button
                      onClick={() => handleChangeEstadoAsamblea('activa')}
                      className="bg-green-600 hover:bg-green-700 shrink-0"
                    >
                      <Play className="w-4 h-4 sm:mr-2 shrink-0" />
                      <span className="hidden sm:inline">Activar asamblea</span>
                      <span className="sm:hidden">Activar</span>
                    </Button>
                  </div>
                ) : (
<Button
                  onClick={() => setSinTokensModalOpen(true)}
                    variant="outline"
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 shrink-0"
                    title="Saldo insuficiente. Clic para comprar tokens"
                  >
                    <Lock className="w-4 h-4 sm:mr-2 shrink-0" />
                    <span className="hidden sm:inline">Activar (saldo insuficiente — comprar tokens)</span>
                    <span className="sm:hidden">Comprar tokens</span>
                  </Button>
                )
              )}
              {(asamblea.estado === 'finalizada' || asamblea.estado === 'activa' || preguntas.some(p => p.estado === 'cerrada')) && (
                actaDisponible ? (
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 shrink-0" title="Acta lista para descarga">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Acta Lista para Descarga</span>
                      <span className="sm:hidden">Acta lista</span>
                    </span>
                    <Link href={`/dashboard/asambleas/${params.id}/acta`} className="shrink-0">
                      <Button variant="outline" className="border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 w-full sm:w-auto">
                        <FileText className="w-4 h-4 sm:mr-2 shrink-0" />
                        <span className="hidden sm:inline">{preguntas.some(p => p.estado === 'cerrada') ? 'Descargar acta (todas las preguntas y votos)' : 'Generar acta'}</span>
                        <span className="sm:hidden">Acta</span>
                      </Button>
                    </Link>
                  </div>
                ) : asamblea.estado === 'borrador' ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Activa la asamblea para habilitar la generación del acta (cobro único de {costoOperacion} tokens).
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Para generar el acta primero activa la asamblea (se cobran {costoOperacion} tokens una sola vez). Saldo: {tokensDisponibles}.
                  </p>
                )
              )}
              {asamblea.estado === 'activa' && !isDemo && (
                <Button
                  variant="outline"
                  onClick={() => setShowModalConfirmarFinalizar(true)}
                  className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 shrink-0"
                  title="Cerrar la asamblea de forma permanente (solo lectura)"
                >
                  <Clock className="w-4 h-4 sm:mr-2 shrink-0" />
                  <span className="hidden sm:inline">Finalizar Asamblea</span>
                  <span className="sm:hidden">Finalizar</span>
                </Button>
              )}
              {asamblea.estado === 'finalizada' && !isDemo && (
                <Button
                  variant="outline"
                  onClick={() => setShowModalConfirmarReabrir(true)}
                  className="border-green-300 dark:border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 shrink-0"
                  title="Reabrir la asamblea para permitir votaciones de nuevo (consume tokens)"
                >
                  <Play className="w-4 h-4 sm:mr-2 shrink-0" />
                  <span className="hidden sm:inline">Reabrir asamblea</span>
                  <span className="sm:hidden">Reabrir</span>
                </Button>
              )}
              {(asamblea.estado === 'activa' || asamblea.estado === 'finalizada') && isDemo && (
                <Button
                  variant="outline"
                  onClick={() => setShowModalConfirmarReiniciarDemo(true)}
                  className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 shrink-0"
                  title="Borrar votos y repetir la simulación"
                >
                  <Play className="w-4 h-4 sm:mr-2 shrink-0" />
                  <span className="hidden sm:inline">Reiniciar Simulación</span>
                  <span className="sm:hidden">Reiniciar</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 overflow-x-hidden">
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

        {/* Registrar voto a nombre de un residente — no consume tokens */}
        {preguntasAbiertas.length > 0 && (
          <div className="mb-6 flex justify-end">
            <div className="flex flex-col gap-1 items-end">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registrar votos por unidad no consume tokens. Los tokens solo se usan al activar la votación o generar el acta.
              </p>
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
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          {/* Columna izquierda en desktop; en móvil se muestra después de Preguntas (votos arriba) */}
          <div className="lg:col-span-1 space-y-6 order-2 lg:order-1 min-w-0">
            {/* Billetera de tokens — colapsada por defecto */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
              <button
                type="button"
                onClick={() => setBilleteraColapsada((v) => !v)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1M11 14l2 2 4-4" />
                  </svg>
                  Billetera de tokens
                </h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {tokensDisponibles} tokens
                </span>
                {billeteraColapsada ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
              </button>
              {!billeteraColapsada && (
                <div className="px-6 pb-6 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
                  {costoOperacion > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Costo al activar la asamblea (una vez): <strong>{costoOperacion} tokens</strong>. Luego puedes generar el acta sin nuevo cobro.
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700 mt-3">
                    <strong>Guía:</strong> Los tokens se cobran <strong>una sola vez al activar la asamblea</strong>; eso habilita generar el acta cuantas veces quieras.
                  </p>
                </div>
              )}
            </div>

            {/* Panel de Credenciales de Prueba (solo Sandbox) */}
            {isDemo && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-3xl shadow-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
                <div className="p-4 border-b border-amber-200 dark:border-amber-800">
                  <h2 className="text-base font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    Credenciales de Prueba
                  </h2>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    Usa estos correos en el login de votación para simular votantes (copia y pega).
                  </p>
                </div>
                <div className="overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-100/50 dark:bg-amber-900/30 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-amber-900 dark:text-amber-100">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-amber-900 dark:text-amber-100">Correo</th>
                        <th className="px-3 py-2 w-16 text-right font-semibold text-amber-900 dark:text-amber-100">Copiar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-200 dark:divide-amber-800">
                      {Array.from({ length: 10 }, (_, i) => {
                        const email = `test${i + 1}@asambleas.online`
                        return (
                          <tr key={email} className="hover:bg-amber-100/30 dark:hover:bg-amber-900/20">
                            <td className="px-3 py-2 text-amber-800 dark:text-amber-200">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-amber-900 dark:text-amber-100">{email}</td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
                                onClick={() => {
                                  navigator.clipboard.writeText(email)
                                  toast.success('Correo copiado')
                                }}
                                title="Copiar correo"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              {/* 1. Acceso Público (arriba) */}
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
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
                    <span className="inline-block px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">✓ Votación activa</span>

                    {/* URL para Compartir */}
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Enlace de Votación
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={asamblea.codigo_acceso ? `${SITE_URL}/votar/${asamblea.codigo_acceso}` : (asamblea.url_publica || '')}
                          readOnly
                          className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-xs text-gray-700 dark:text-gray-300"
                        />
                        <Button
                          onClick={() => handleCopiarTexto(asamblea.codigo_acceso ? `${SITE_URL}/votar/${asamblea.codigo_acceso}` : (asamblea.url_publica || ''), 'URL')}
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
                        onClick={openModalEnviarEnlace}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                        size="sm"
                        title="Enviar el enlace por WhatsApp o correo a cada unidad por separado (no se ven entre sí)"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Enviar a cada uno
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
                      <div className="col-span-2" />
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
                      Comparte el enlace o el QR con los residentes para que puedan votar
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Gestión de Poderes */}
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Gestión de Poderes
                </h3>
                <Link href={`/dashboard/asambleas/${params.id}/poderes`} className="block" title="Administrar poderes y representación">
                  <Button
                    variant="outline"
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0"
                    size="lg"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Gestión de Poderes
                  </Button>
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Administra quién vota en representación de otros
                </p>
              </div>

              {/* 3. Información (abajo) */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Información
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
                    {asamblea.fecha ? formatFecha(asamblea.fecha) : '—'}
                    {puedeEditarFecha && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-indigo-600 dark:text-indigo-400"
                        onClick={openEditFechaModal}
                        title="Cambiar fecha y hora de la asamblea"
                      >
                        Editar fecha y hora
                      </Button>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Estado:</span>
                    {getEstadoBadge(asamblea.estado)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preguntas / votos: en móvil arriba */}
          <div className="lg:col-span-2 order-1 lg:order-2 min-w-0">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Preguntas de Votación
                </h2>
                {preguntas.length < planLimits.max_preguntas_por_asamblea && !isDemo && !isReadOnlyStructure && (
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

              {preguntas.length >= planLimits.max_preguntas_por_asamblea && !isDemo && (
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

              {(() => {
                const preguntasActivas = preguntas.filter((p) => !p.is_archived)
                const preguntasArchivadas = preguntas.filter((p) => p.is_archived)
                const noHayNinguna = preguntas.length === 0
                return noHayNinguna ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No hay preguntas creadas
                  </p>
                  {preguntas.length < planLimits.max_preguntas_por_asamblea && !isDemo && !isReadOnlyStructure && (
                    <Button
                      onClick={() => setShowNewPregunta(true)}
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Primera Pregunta
                    </Button>
                  )}
                  {!isDemo && isReadOnlyStructure && (
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-3 max-w-md mx-auto">
                      La estructura está cerrada: pasaron más de 72 h desde la activación o la asamblea está finalizada. No se pueden agregar ni editar preguntas (solo consultar y generar acta).
                    </p>
                  )}
                </div>
              ) : preguntasActivas.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No hay preguntas en el orden del día. Las que archives aparecerán en la sección inferior.
                  </p>
                  {preguntasArchivadas.length > 0 && (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPreguntasArchivadas((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span>Preguntas archivadas ({preguntasArchivadas.length})</span>
                        {showPreguntasArchivadas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showPreguntasArchivadas && (
                        <div className="p-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
                          {preguntasArchivadas.map((pregunta) => (
                            <div
                              key={pregunta.id}
                              className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/50"
                            >
                              <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{pregunta.texto_pregunta}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDesarchivarPregunta(pregunta.id)}
                                disabled={archivingPreguntaId === pregunta.id || isReadOnlyStructure}
                                title={isReadOnlyStructure ? 'Estructura congelada' : 'Devolver al orden del día'}
                              >
                                {archivingPreguntaId === pregunta.id ? (
                                  <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <ArchiveRestore className="w-4 h-4 mr-1" />
                                )}
                                Desarchivar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mensaje informativo: preguntas archivadas no van al acta */}
                  {preguntasArchivadas.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1" title="Las preguntas archivadas no aparecerán en el acta final">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                      Las preguntas archivadas no aparecen en el acta final.
                    </p>
                  )}
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

                  {preguntasActivas.map((pregunta, index) => (
                    <div
                      key={pregunta.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-3xl p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                    >
                      {/* Header de la pregunta */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              #{index + 1}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded capitalize">
                              {pregunta.tipo_votacion}
                            </span>
                            {getEstadoPreguntaBadge(pregunta.estado)}
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 break-words">
                            {pregunta.texto_pregunta}
                          </h3>
                          {pregunta.descripcion && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 break-words">
                              {pregunta.descripcion}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:ml-4 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => !isDemo && !isReadOnlyStructure && handleEditClick(pregunta)}
                            disabled={isDemo || isReadOnlyStructure}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1"
                            title={isDemo ? 'Modo demostración: no se puede editar' : isReadOnlyStructure ? 'Estructura congelada (solo lectura)' : (pregunta.estado === 'pendiente' ? 'Editar pregunta completa' : 'Editar texto (se actualiza en acceso)')}
                          >
                            <Edit className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs">
                              {pregunta.estado === 'pendiente' ? 'Editar' : 'Editar texto'}
                            </span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchivarPregunta(pregunta.id)}
                            disabled={archivingPreguntaId === pregunta.id || isReadOnlyStructure}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-1"
                            title={isReadOnlyStructure ? 'Estructura congelada' : 'Las preguntas archivadas no aparecerán en el acta final'}
                          >
                            {archivingPreguntaId === pregunta.id ? (
                              <span className="inline-block w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline text-xs">Archivar</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => !isDemo && !isReadOnlyStructure && setDeletingPregunta(pregunta)}
                            disabled={pregunta.estado === 'abierta' || isDemo || isReadOnlyStructure}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={isDemo ? 'Modo demostración: no se puede eliminar' : (pregunta.estado === 'abierta' ? 'No puedes eliminar una pregunta abierta' : 'Eliminar pregunta')}
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

                      {/* Controles de estado: en sandbox se permite abrir/cerrar/reabrir; no editar ni eliminar */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        {pregunta.estado === 'pendiente' && (
                          <Button
                            size="sm"
                            onClick={() => handleChangeEstadoPregunta(pregunta.id, 'abierta')}
                            className="bg-green-600 hover:bg-green-700"
                            title="Abrir pregunta para votar"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Abrir Pregunta
                          </Button>
                        )}
                        {pregunta.estado === 'abierta' && (
                          <Button
                            size="sm"
                            onClick={() => handleChangeEstadoPregunta(pregunta.id, 'cerrada')}
                            className="bg-blue-600 hover:bg-blue-700"
                            title="Cerrar esta pregunta (no se podrán emitir más votos)"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cerrar Pregunta
                          </Button>
                        )}
                        {pregunta.estado === 'cerrada' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleChangeEstadoPregunta(pregunta.id, 'abierta')}
                              title="Reabrir pregunta"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Reabrir Pregunta
                            </Button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              • Pregunta cerrada
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Preguntas archivadas (colapsable) */}
                  {preguntasArchivadas.length > 0 && (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPreguntasArchivadas((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span>Preguntas archivadas ({preguntasArchivadas.length})</span>
                        {showPreguntasArchivadas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showPreguntasArchivadas && (
                        <div className="p-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
                          {preguntasArchivadas.map((pregunta) => (
                            <div
                              key={pregunta.id}
                              className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/50"
                            >
                              <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{pregunta.texto_pregunta}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDesarchivarPregunta(pregunta.id)}
                                disabled={archivingPreguntaId === pregunta.id || isReadOnlyStructure}
                                title={isReadOnlyStructure ? 'Estructura congelada' : 'Devolver al orden del día'}
                              >
                                {archivingPreguntaId === pregunta.id ? (
                                  <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <ArchiveRestore className="w-4 h-4 mr-1" />
                                )}
                                Desarchivar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
              })()}
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
              <Label className="text-gray-700 dark:text-gray-300">Torre y número</Label>
              <select
                value={unidadRegistroVoto}
                onChange={(e) => handleUnidadChangeRegistro(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              >
                <option value="">Selecciona torre y número</option>
                {unidadesParaVoto.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.torre || '—'} - {u.numero}
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

      {/* Modal: Asamblea activada — ventana de gracia 3 días */}
      <Dialog open={showModalAsambleaActivada} onOpenChange={setShowModalAsambleaActivada}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle2 className="w-5 h-5" />
              ¡Asamblea Activada!
            </DialogTitle>
            <DialogDescription>
              Tienes <strong>3 días (72 horas)</strong> para realizar ajustes finales antes de que la estructura se congele. Puedes agregar, editar o archivar preguntas y unidades durante este periodo. Después, o al pulsar &quot;Finalizar Asamblea&quot;, la asamblea quedará en solo lectura y podrás generar el acta cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Button onClick={() => setShowModalAsambleaActivada(false)} className="w-full">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Enviar enlace por WhatsApp o correo a cada unidad (cada envío por separado) */}
      <Dialog open={showModalEnviarEnlace} onOpenChange={setShowModalEnviarEnlace}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <LinkIcon className="w-5 h-5" />
              Enviar enlace de votación a cada contacto
            </DialogTitle>
            <DialogDescription>
              Cada envío se abre por separado (WhatsApp o correo) para que nadie vea el teléfono o email de otros. Usa los teléfonos y correos registrados en las unidades del conjunto. Puedes añadir un WhatsApp adicional (ej. grupo de la copropiedad) que no esté asociado a ninguna unidad.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 py-2">
            {loadingUnidadesEnvio ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Cargando unidades...</p>
            ) : (
              <>
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    WhatsApp adicional (ej. grupo de la copropiedad)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Si tienes un grupo o número de WhatsApp de la copropiedad que no está inscrito a ninguna unidad, agrégalo aquí.
                  </p>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Input
                      type="tel"
                      placeholder="Ej. 573001234567 o 3001234567"
                      value={whatsappAdicionalEnvio}
                      onChange={(e) => setWhatsappAdicionalEnvio(e.target.value)}
                      className="max-w-[220px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                      onClick={() => {
                        const num = normalizarTelefonoWhatsApp(whatsappAdicionalEnvio)
                        if (!num) {
                          toast.error('Ingresa un número válido')
                          return
                        }
                        abrirWhatsAppUnidad(whatsappAdicionalEnvio)
                      }}
                    >
                      Enviar a este número
                    </Button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    Por WhatsApp (teléfono de la unidad)
                  </h3>
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 p-2">
                    {unidadesParaEnvio
                      .filter((u) => (u.telefono_propietario || u.telefono)?.trim())
                      .map((u) => {
                        const tel = (u.telefono_propietario || u.telefono)?.trim() ?? ''
                        return (
                          <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-gray-700 dark:text-gray-300">
                              {u.torre ? `${u.torre} - ` : ''}{u.numero}
                              {tel ? ` · ${tel}` : ''}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                              onClick={() => abrirWhatsAppUnidad(tel)}
                            >
                              WhatsApp
                            </Button>
                          </li>
                        )
                      })}
                    {unidadesParaEnvio.filter((u) => (u.telefono_propietario || u.telefono)?.trim()).length === 0 && (
                      <li className="text-gray-500 dark:text-gray-400 text-sm py-2">No hay unidades con teléfono registrado.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    Por correo (email de la unidad)
                  </h3>
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 p-2">
                    {unidadesParaEnvio
                      .filter((u) => (u.email_propietario || u.email)?.trim())
                      .map((u) => {
                        const email = (u.email_propietario || u.email)?.trim() ?? ''
                        return (
                          <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-gray-700 dark:text-gray-300">
                              {u.torre ? `${u.torre} - ` : ''}{u.numero}
                              {email ? ` · ${email}` : ''}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                              onClick={() => abrirCorreoUnidad(email)}
                            >
                              Correo
                            </Button>
                          </li>
                        )
                      })}
                    {unidadesParaEnvio.filter((u) => (u.email_propietario || u.email)?.trim()).length === 0 && (
                      <li className="text-gray-500 dark:text-gray-400 text-sm py-2">No hay unidades con correo registrado.</li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setShowModalEnviarEnlace(false)} className="w-full">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar finalizar asamblea */}
      <Dialog open={showModalConfirmarFinalizar} onOpenChange={setShowModalConfirmarFinalizar}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-5 h-5" />
              ¿Finalizar asamblea?
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de finalizar? Esto archivará los resultados permanentemente y generará el acta definitiva. La estructura (preguntas y unidades) quedará en <strong>solo lectura</strong> y no podrás editarla de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setShowModalConfirmarFinalizar(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              className="flex-1 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              disabled={finalizando}
              onClick={handleFinalizarAsamblea}
            >
              {finalizando ? 'Finalizando…' : 'Sí, finalizar asamblea'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar reiniciar simulación (demo) */}
      <Dialog open={showModalConfirmarReiniciarDemo} onOpenChange={setShowModalConfirmarReiniciarDemo}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Play className="w-5 h-5" />
              ¿Reiniciar simulación?
            </DialogTitle>
            <DialogDescription>
              Se borrarán todos los votos de esta asamblea de simulación. Las preguntas y unidades se mantendrán. Podrás repetir la experiencia de votación desde cero.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setShowModalConfirmarReiniciarDemo(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              className="flex-1 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              disabled={reiniciandoDemo}
              onClick={handleReiniciarSimulacion}
            >
              {reiniciandoDemo ? 'Reiniciando…' : 'Sí, reiniciar simulación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar reabrir asamblea (solo finalizada; consume 10% tokens) */}
      <Dialog open={showModalConfirmarReabrir} onOpenChange={setShowModalConfirmarReabrir}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Play className="w-5 h-5" />
              ¿Reabrir asamblea?
            </DialogTitle>
            <DialogDescription>
              Al reabrir la asamblea se permitirá de nuevo el acceso a la votación con el mismo enlace y código. Esta acción consumirá <strong>{costoReapertura} tokens</strong> (10% del costo de la primera activación). Tu saldo actual es <strong>{tokensDisponibles} tokens</strong>. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setShowModalConfirmarReabrir(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={reabriendo || tokensDisponibles < costoReapertura}
              onClick={handleReabrirAsamblea}
            >
              {reabriendo ? 'Reabriendo…' : `Sí, reabrir (${costoReapertura} tokens)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Sin tokens al activar / generar acta — CTA usa checkout API; cantidad editable (mín. 20) */}
      <Dialog open={sinTokensModalOpen} onOpenChange={setSinTokensModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-amber-800 dark:text-amber-200">¡Ups! Te faltan tokens para iniciar esta asamblea</DialogTitle>
            <DialogDescription>
              Para activar esta asamblea necesitas <strong>{costoOperacion} tokens</strong>. Tu saldo actual es <strong>{tokensDisponibles}</strong>. Compra los tokens necesarios para activar la votación; después podrás generar el acta sin nuevo cobro.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            {userId ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad de tokens (mín. {MIN_TOKENS_COMPRA})</label>
                  <input
                    type="number"
                    min={1}
                    placeholder={`Mín. ${MIN_TOKENS_COMPRA}`}
                    value={cantidadCompraSinTokens === 0 ? '' : cantidadCompraSinTokens}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setCantidadCompraSinTokens(0)
                        return
                      }
                      const v = parseInt(e.target.value, 10)
                      setCantidadCompraSinTokens(Number.isNaN(v) ? 0 : Math.max(0, v))
                    }}
                    className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100"
                  />
                  {cantidadCompraSinTokens > 0 && cantidadCompraSinTokens < MIN_TOKENS_COMPRA && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Mínimo {MIN_TOKENS_COMPRA} tokens para comprar</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={checkoutLoadingSinTokens || cantidadCompraSinTokens < MIN_TOKENS_COMPRA}
                  onClick={async () => {
                    setCheckoutLoadingSinTokens(true)
                    try {
                      const cantidad = Math.max(MIN_TOKENS_COMPRA, cantidadCompraSinTokens)
                      const res = await fetch('/api/pagos/checkout-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          user_id: userId,
                          conjunto_id: asamblea?.organization_id ?? undefined,
                          cantidad_tokens: cantidad,
                        }),
                      })
                      const data = await res.json().catch(() => ({}))
                      if (res.ok && data?.url) {
                        setSinTokensModalOpen(false)
                        window.location.href = data.url
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
                  {checkoutLoadingSinTokens ? 'Generando enlace...' : `Comprar ${Math.max(MIN_TOKENS_COMPRA, cantidadCompraSinTokens)} tokens ahora`}
                </button>
              </>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-3xl bg-slate-200 dark:bg-slate-700 text-slate-500 text-base font-semibold cursor-not-allowed">
                Inicia sesión para comprar tokens.
              </span>
            )}
            <Button type="button" variant="outline" onClick={() => setSinTokensModalOpen(false)} className="w-full">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar fecha (paso 1) — solo borrador/activa */}
      <Dialog open={showEditFechaModal} onOpenChange={setShowEditFechaModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Calendar className="w-5 h-5" />
              Cambiar fecha y hora de la asamblea
            </DialogTitle>
            <DialogDescription>
              La nueva fecha y hora se aplicarán a la asamblea. Deberás confirmar el cambio en el siguiente paso.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="edit-fecha-input">Nueva fecha</Label>
              <Input
                id="edit-fecha-input"
                type="date"
                value={editFechaValue}
                onChange={(e) => setEditFechaValue(e.target.value)}
                className="w-full mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-hora-input">Hora</Label>
              <Input
                id="edit-hora-input"
                type="time"
                value={editHoraValue}
                onChange={(e) => setEditHoraValue(e.target.value)}
                className="w-full mt-1"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowEditFechaModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setShowEditFechaModal(false)
                  setShowConfirmFechaModal(true)
                }}
                disabled={!editFechaValue.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar cambio de fecha (paso 2 — doble confirmación) */}
      <Dialog open={showConfirmFechaModal} onOpenChange={setShowConfirmFechaModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>¿Confirmar cambio de fecha y hora?</DialogTitle>
            <DialogDescription>
              La asamblea quedará programada para: <strong>{editFechaValue && editHoraValue ? new Date(editFechaValue + 'T' + (editHoraValue.trim() || '10:00').slice(0, 5) + ':00').toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : ''}</strong>. ¿Deseas guardar este cambio?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setShowConfirmFechaModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarCambioFecha}
              disabled={savingFecha || !editFechaValue.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {savingFecha ? 'Guardando…' : 'Sí, guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Guía de paneles (Quórum, Preguntas, Poderes) — onboarding asamblea */}
      <Dialog open={showGuiaAsambleaModal} onOpenChange={setShowGuiaAsambleaModal}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              Guía de esta asamblea
            </DialogTitle>
            <DialogDescription>
              Qué hace cada sección del panel de control
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Quórum y participación
              </h4>
              <p className="mt-1">
                Muestra en tiempo real cuántas unidades han votado y el coeficiente acumulado (Ley 675). Necesitas al menos 50% del coeficiente para alcanzar quórum.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Preguntas de votación
              </h4>
              <p className="mt-1">
                Aquí creas y gestionas las preguntas. Puedes abrir o cerrar cada pregunta para que los residentes voten. Los resultados se actualizan en vivo.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-500" />
                Gestión de poderes
              </h4>
              <p className="mt-1">
                Desde el enlace correspondiente puedes registrar poderes (delegación de voto) para que un apoderado vote por varias unidades.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowGuiaAsambleaModal(false)} className="w-full mt-4">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>

      <GuiaTokensModal open={guiaModalOpen} onOpenChange={setGuiaModalOpen} />
    </div>
  )
}
