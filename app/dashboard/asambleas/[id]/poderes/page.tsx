'use client'

import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Plus, 
  Trash2,
  Pencil,
  Search,
  FileText,
  Users,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  Home,
  HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'
import { GuiaTokensModal } from '@/components/GuiaTokensModal'
import { matchesTorreUnidadSearch } from '@/lib/matchUnidadSearch'
import {
  mensajeErrorInsertPoder,
  emailContactoUnidad,
  esDocumentoPoderValido,
  extensionDocPoder,
  normalizarEmailReceptor,
  validarLimiteReceptoresLote,
  insertarPoderesYSubirDocumentos,
} from '@/lib/poderes-registro'

interface Asamblea {
  id: string
  nombre: string
  fecha: string
  estado: string
  organization_id: string
  is_demo?: boolean
  sandbox_usar_unidades_reales?: boolean
}

interface Unidad {
  id: string
  numero: string
  torre: string
  coeficiente: number
  nombre_propietario: string
  email: string
  tipo: string
}

interface Poder {
  id: string
  unidad_otorgante_id: string
  unidad_receptor_id: string | null
  email_otorgante: string
  nombre_otorgante: string
  email_receptor: string
  nombre_receptor: string
  estado: string
  coeficiente_delegado: number
  unidad_otorgante_numero: string
  unidad_otorgante_torre: string
  unidad_receptor_numero: string | null
  unidad_receptor_torre: string | null
  archivo_poder: string | null
  observaciones: string | null
  created_at: string
}

interface ResumenPoderes {
  total_poderes_activos: number
  total_unidades_delegadas: number
  coeficiente_total_delegado: number
  porcentaje_coeficiente: number
}

interface ConfigPoderes {
  max_poderes_por_apoderado: number
  requiere_documento: boolean
}

type PoderModalState = { type: 'none' } | { type: 'create' } | { type: 'edit'; poder: Poder }

function ChecklistPoderLey675() {
  const [abierto, setAbierto] = useState(false)
  const items = [
    'Datos completos del propietario que otorga (nombre, identificación, unidad)',
    'Datos completos del apoderado (nombre, identificación)',
    'Descripción clara de los actos autorizados (votar en la asamblea, temas específicos)',
    'Identificación explícita de quién otorga y quién recibe el poder',
    'Firma del propietario y fecha',
    'Referencia a la asamblea o conjunto (según reglamento)'
  ]
  return (
    <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          Verifique que el documento incluya (Ley 675 y práctica)
        </span>
        {abierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {abierto && (
        <ul className="px-4 pb-4 pt-1 space-y-2 text-sm text-amber-900/90 dark:text-amber-100/90">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-amber-500 dark:text-amber-400 shrink-0">•</span>
              {item}
            </li>
          ))}
          <p className="text-xs text-amber-700/80 dark:text-amber-200/80 pt-1">
            Revise el documento antes de subirlo. Esta lista es orientativa; consulte a un abogado si tiene dudas.
          </p>
        </ul>
      )}
    </div>
  )
}

/** Entrada en cola para registrar varios poderes seguidos (misma sesión) */
interface ColaPoderItem {
  id: string
  unidad_otorgante_id: string
  unidad_receptor_id: string | null
  email_otorgante: string
  nombre_otorgante: string
  email_receptor: string
  nombre_receptor: string
  observaciones: string | null
  archivo: File | null
}

type PoderSortKey =
  | 'unidad_otorgante'
  | 'propietario'
  | 'apoderado'
  | 'coeficiente'
  | 'documento'
  | 'registrado'
  | 'estado'
  | 'acciones'

export default function PoderesPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const toast = useToast()
  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [poderes, setPoderes] = useState<Poder[]>([])
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [resumen, setResumen] = useState<ResumenPoderes | null>(null)
  const [config, setConfig] = useState<ConfigPoderes>({ max_poderes_por_apoderado: 3, requiere_documento: false })
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')

  // Modal crear / editar poder
  const [poderModal, setPoderModal] = useState<PoderModalState>({ type: 'none' })
  const [searchOtorgante, setSearchOtorgante] = useState('')
  const [searchReceptor, setSearchReceptor] = useState('')
  const [selectedOtorgante, setSelectedOtorgante] = useState<Unidad | null>(null)
  const [selectedReceptor, setSelectedReceptor] = useState<Unidad | null>(null)
  const [emailReceptor, setEmailReceptor] = useState('')
  const [nombreReceptor, setNombreReceptor] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [archivoPoder, setArchivoPoder] = useState<File | null>(null)
  const [savingPoder, setSavingPoder] = useState(false)
  /** true = apoderado es tercero (no es propietario de una unidad); false = apoderado es otra unidad del conjunto */
  const [apoderadoEsTercero, setApoderadoEsTercero] = useState(false)
  /** Varios poderes para guardar en un solo flujo (sin cerrar el modal entre uno y otro) */
  const [colaPoderes, setColaPoderes] = useState<ColaPoderItem[]>([])
  /** Remount del bloque «unidad otorgante» tras añadir a la cola para dejar búsqueda y UI limpias */
  const [otorgantePickerNonce, setOtorgantePickerNonce] = useState(0)

  // Reemplazar documento
  const [reemplazandoPoderId, setReemplazandoPoderId] = useState<string | null>(null)
  const [archivoReemplazo, setArchivoReemplazo] = useState<File | null>(null)
  const [reemplazando, setReemplazando] = useState(false)

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('')
  /** Vigentes, pendientes de verificar o histórico completo */
  const [filtroEstadoPoder, setFiltroEstadoPoder] = useState<'activos' | 'pendientes' | 'todos'>('activos')
  /** Filtrar por unidad que otorga el poder (UUID) */
  const [filtroUnidadOtorganteId, setFiltroUnidadOtorganteId] = useState<string>('')
  const [mostrarInfoPoderes, setMostrarInfoPoderes] = useState(false)
  const [sortKey, setSortKey] = useState<PoderSortKey>('registrado')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [revocandoPoderId, setRevocandoPoderId] = useState<string | null>(null)
  const [revocando, setRevocando] = useState(false)
  const [activandoPoderId, setActivandoPoderId] = useState<string | null>(null)
  const [guiaModalOpen, setGuiaModalOpen] = useState(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
  }, [params.id])

  // Auto-fill: al seleccionar unidad otorgante o receptora, buscar datos en BD y autorrellenar Email, Nombre, Coeficiente
  useEffect(() => {
    if (!selectedOtorgante?.id) return
    let cancelled = false
    supabase
      .from('unidades')
      .select('id, numero, torre, coeficiente, nombre_propietario, email_propietario, email')
      .eq('id', selectedOtorgante.id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return
        setSelectedOtorgante((prev) => (prev ? { ...prev, ...data, coeficiente: Number(data.coeficiente) || 0 } : null))
      })
    return () => { cancelled = true }
  }, [selectedOtorgante?.id])

  useEffect(() => {
    if (!selectedReceptor?.id) return
    let cancelled = false
    supabase
      .from('unidades')
      .select('id, numero, torre, coeficiente, nombre_propietario, email_propietario, email')
      .eq('id', selectedReceptor.id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return
        const u = data as { nombre_propietario?: string; email_propietario?: string; email?: string }
        setEmailReceptor(u.email_propietario ?? u.email ?? '')
        setNombreReceptor(u.nombre_propietario ?? '')
      })
    return () => { cancelled = true }
  }, [selectedReceptor?.id])

  const resetPoderForm = () => {
    setSelectedOtorgante(null)
    setSelectedReceptor(null)
    setApoderadoEsTercero(false)
    setEmailReceptor('')
    setNombreReceptor('')
    setObservaciones('')
    setArchivoPoder(null)
    setSearchOtorgante('')
    setSearchReceptor('')
  }

  const closePoderModal = () => {
    setPoderModal({ type: 'none' })
    resetPoderForm()
    setColaPoderes([])
  }

  const openCreatePoderModal = () => {
    resetPoderForm()
    setColaPoderes([])
    setOtorgantePickerNonce(0)
    setPoderModal({ type: 'create' })
  }

  // Rellenar formulario al abrir edición
  useEffect(() => {
    if (poderModal.type !== 'edit') return
    const p = poderModal.poder
    const uo = unidades.find((u) => u.id === p.unidad_otorgante_id)
    setSelectedOtorgante(uo ?? null)
    const isTercero = !p.unidad_receptor_id
    setApoderadoEsTercero(isTercero)
    if (p.unidad_receptor_id) {
      const ur = unidades.find((u) => u.id === p.unidad_receptor_id)
      setSelectedReceptor(ur ?? null)
    } else {
      setSelectedReceptor(null)
    }
    setEmailReceptor(p.email_receptor)
    setNombreReceptor(p.nombre_receptor)
    setObservaciones(p.observaciones ?? '')
    setSearchOtorgante('')
    setSearchReceptor('')
    setArchivoPoder(null)
  }, [poderModal, unidades])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        toast.error('Por favor selecciona un conjunto primero')
        router.push('/dashboard')
        return
      }

      // Cargar asamblea (incl. is_demo para filtrar unidades en no-sandbox)
      const { data: asambleaData, error: asambleaError } = await supabase
        .from('asambleas')
        .select('id, nombre, fecha, estado, organization_id, is_demo, sandbox_usar_unidades_reales')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (asambleaError) throw asambleaError
      setAsamblea(asambleaData)

      // Cargar unidades del conjunto: en asambleas no sandbox solo unidades reales; en sandbox según sandbox_usar_unidades_reales
      const soloUnidadesDemo = (asambleaData as { is_demo?: boolean })?.is_demo === true &&
        !((asambleaData as { sandbox_usar_unidades_reales?: boolean })?.sandbox_usar_unidades_reales === true)
      let queryUnidades = supabase
        .from('unidades')
        .select('*')
        .eq('organization_id', selectedConjuntoId)
        .order('torre', { ascending: true })
        .order('numero', { ascending: true })
      queryUnidades = soloUnidadesDemo ? queryUnidades.eq('is_demo', true) : queryUnidades.or('is_demo.eq.false,is_demo.is.null')
      const { data: unidadesData, error: unidadesError } = await queryUnidades

      if (unidadesError) throw unidadesError
      setUnidades(unidadesData || [])

      // Cargar configuración de poderes
      const { data: configData } = await supabase
        .from('configuracion_poderes')
        .select('max_poderes_por_apoderado, requiere_documento')
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (configData) {
        setConfig(configData)
      }

      // Cargar poderes
      await loadPoderes()

      // Cargar resumen
      await loadResumen()

      setLoading(false)
    } catch (error: any) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar los datos: ' + error.message)
      setLoading(false)
    }
  }

  const loadPoderes = async () => {
    try {
      const { data, error } = await supabase
        .from('vista_poderes_completa')
        .select('*')
        .eq('asamblea_id', params.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPoderes(data || [])
    } catch (error: any) {
      console.error('Error loading poderes:', error)
    }
  }

  const loadResumen = async () => {
    try {
      const { data, error } = await supabase.rpc('resumen_poderes_asamblea', {
        p_asamblea_id: params.id
      })

      if (!error && data && data.length > 0) {
        setResumen(data[0])
      } else {
        // Fallback manual si la función no existe
        const { data: poderesData } = await supabase
          .from('poderes')
          .select('*, unidades!inner(coeficiente)')
          .eq('asamblea_id', params.id)
          .eq('estado', 'activo')

        const totalPoderes = poderesData?.length || 0
        const coeficienteDelegado = poderesData?.reduce((sum: number, p: any) => 
          sum + (p.unidades?.coeficiente || 0), 0) || 0

        setResumen({
          total_poderes_activos: totalPoderes,
          total_unidades_delegadas: totalPoderes,
          coeficiente_total_delegado: coeficienteDelegado,
          porcentaje_coeficiente: 0 // Calcular después
        })
      }
    } catch (error: any) {
      console.error('Error loading resumen:', error)
    }
  }

  const buildColaItemFromForm = (): ColaPoderItem | null => {
    if (!selectedOtorgante) return null
    if (!apoderadoEsTercero && !selectedReceptor) return null
    if (!emailReceptor.trim() || !nombreReceptor.trim()) return null
    const emailOtorgante = emailContactoUnidad(selectedOtorgante as { email_propietario?: string; email?: string })
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tmp-${Date.now()}`,
      unidad_otorgante_id: selectedOtorgante.id,
      unidad_receptor_id: apoderadoEsTercero ? null : (selectedReceptor?.id ?? null),
      email_otorgante: emailOtorgante,
      nombre_otorgante: selectedOtorgante.nombre_propietario,
      email_receptor: emailReceptor.trim(),
      nombre_receptor: nombreReceptor.trim(),
      observaciones: observaciones.trim() || null,
      archivo: archivoPoder,
    }
  }

  /**
   * Añade la fila actual a la lista sin guardar aún.
   * Caso habitual: mismo apoderado, varias unidades que delegan → se conservan apoderado y datos de contacto;
   * solo se pide elegir otra unidad otorgante (y opcionalmente doc/notas por fila).
   */
  const agregarPoderALaCola = async () => {
    if (poderModal.type !== 'create') return
    const item = buildColaItemFromForm()
    if (!item) {
      toast.error('Completa unidad otorgante, apoderado, correo/identificación y nombre para añadir a la cola.')
      return
    }
    if (archivoPoder && !esDocumentoPoderValido(archivoPoder)) {
      toast.error('El documento debe ser PDF o Word (.doc, .docx) y máximo 2MB')
      return
    }
    const keyApoderado = normalizarEmailReceptor(item.email_receptor.trim())
    const enColaMismoApoderado = colaPoderes.filter(
      (c) => normalizarEmailReceptor(c.email_receptor.trim()) === keyApoderado
    )
    const okLim = await validarLimiteReceptoresLote(supabase, params.id, asamblea?.organization_id, [
      ...enColaMismoApoderado.map((c) => ({ email_receptor: c.email_receptor })),
      { email_receptor: item.email_receptor },
    ])
    if (!okLim.ok) {
      toast.error(okLim.mensaje)
      return
    }
    const dup = colaPoderes.some(
      (c) =>
        c.unidad_otorgante_id === item.unidad_otorgante_id &&
        c.email_receptor.trim().toLowerCase() === item.email_receptor.trim().toLowerCase()
    )
    if (dup) {
      toast.error('Ya hay en la cola un poder con la misma unidad que otorga y el mismo apoderado.')
      return
    }
    // Tras await, agrupar en flushSync evita que el paso 1 quede un instante con la unidad anterior seleccionada
    flushSync(() => {
      setColaPoderes((prev) => [...prev, item])
      setSelectedOtorgante(null)
      setSearchOtorgante('')
      setObservaciones('')
      setArchivoPoder(null)
      setOtorgantePickerNonce((n) => n + 1)
    })
    const total = colaPoderes.length + 1
    toast.success(
      `En lista: ${total} fila(s). El apoderado se mantiene: elige otra unidad que otorga (paso 1) o pulsa «Registrar todo».`
    )
  }

  const handleCreatePoder = async () => {
    if (poderModal.type !== 'create') return

    const desdeCola = [...colaPoderes]
    const desdeForm = buildColaItemFromForm()
    if (desdeForm && archivoPoder && !esDocumentoPoderValido(archivoPoder)) {
      toast.error('El documento debe ser PDF o Word (.doc, .docx) y máximo 2MB')
      return
    }

    const items: ColaPoderItem[] = [...desdeCola]
    if (desdeForm) {
      const dupForm = desdeCola.some(
        (c) =>
          c.unidad_otorgante_id === desdeForm.unidad_otorgante_id &&
          c.email_receptor.trim().toLowerCase() === desdeForm.email_receptor.trim().toLowerCase()
      )
      if (!dupForm) items.push(desdeForm)
    }

    if (items.length === 0) {
      toast.error('Añade poderes a la cola o completa el formulario para registrar.')
      return
    }

    const limLote = await validarLimiteReceptoresLote(
      supabase,
      params.id,
      asamblea?.organization_id,
      items.map((i) => ({ email_receptor: i.email_receptor }))
    )
    if (!limLote.ok) {
      toast.error(limLote.mensaje)
      return
    }

    setSavingPoder(true)
    try {
      await insertarPoderesYSubirDocumentos(
        supabase,
        params.id,
        items.map((item) => ({
          campos: {
            unidad_otorgante_id: item.unidad_otorgante_id,
            unidad_receptor_id: item.unidad_receptor_id,
            email_otorgante: item.email_otorgante,
            nombre_otorgante: item.nombre_otorgante,
            email_receptor: item.email_receptor,
            nombre_receptor: item.nombre_receptor,
            observaciones: item.observaciones,
          },
          archivo: item.archivo,
        }))
      )
      const msg = `Se registraron ${items.length} poder(es).`
      setSuccessMessage(msg)
      setTimeout(() => setSuccessMessage(''), 5000)
      toast.success(msg)
      closePoderModal()
      await loadPoderes()
      await loadResumen()
    } catch (error: unknown) {
      console.error('Error creating poder:', error)
      const e = error as { message?: string; code?: string }
      toast.error('Error al crear el poder: ' + mensajeErrorInsertPoder(e))
    } finally {
      setSavingPoder(false)
    }
  }

  const handleUpdatePoder = async () => {
    if (poderModal.type !== 'edit') return
    const poderExistente = poderModal.poder

    if (!selectedOtorgante) {
      toast.error('Debes seleccionar la unidad que otorga el poder')
      return
    }

    if (!apoderadoEsTercero && !selectedReceptor) {
      toast.error('Debes seleccionar la unidad del apoderado o marcar "Apoderado es tercero"')
      return
    }

    if (!emailReceptor.trim()) {
      toast.error('Debes ingresar el identificador del apoderado (email, teléfono o identificación)')
      return
    }

    if (!nombreReceptor.trim()) {
      toast.error('Debes ingresar el nombre del apoderado')
      return
    }

    const emailTrim = emailReceptor.trim()
    const emailAnterior = poderExistente.email_receptor.trim()
    if (emailTrim.toLowerCase() !== emailAnterior.toLowerCase()) {
      const lim = await validarLimiteReceptoresLote(supabase, params.id, asamblea?.organization_id, [
        { email_receptor: emailTrim },
      ])
      if (!lim.ok) {
        toast.error(lim.mensaje)
        return
      }
    }

    if (selectedOtorgante.id !== poderExistente.unidad_otorgante_id) {
      const { count, error: cntErr } = await supabase
        .from('poderes')
        .select('*', { count: 'exact', head: true })
        .eq('asamblea_id', params.id)
        .eq('unidad_otorgante_id', selectedOtorgante.id)
        .eq('estado', 'activo')
        .neq('id', poderExistente.id)
      if (cntErr) {
        console.error('Error comprobando duplicado otorgante:', cntErr)
      } else if (count && count > 0) {
        toast.error(
          'Esa unidad que delega ya tiene un poder activo en esta asamblea. Revócalo o edita el registro para cambiar de apoderado.'
        )
        return
      }
    }

    const emailOtorgante = emailContactoUnidad(selectedOtorgante as { email_propietario?: string; email?: string })

    setSavingPoder(true)
    try {
      const { error } = await supabase
        .from('poderes')
        .update({
          unidad_otorgante_id: selectedOtorgante.id,
          unidad_receptor_id: apoderadoEsTercero ? null : (selectedReceptor?.id ?? null),
          email_otorgante: emailOtorgante,
          nombre_otorgante: selectedOtorgante.nombre_propietario,
          email_receptor: emailTrim,
          nombre_receptor: nombreReceptor.trim(),
          observaciones: observaciones.trim() || null,
        })
        .eq('id', poderExistente.id)

      if (error) throw error

      setSuccessMessage('Poder actualizado correctamente')
      setTimeout(() => setSuccessMessage(''), 3000)
      closePoderModal()
      await loadPoderes()
      await loadResumen()
    } catch (error: any) {
      console.error('Error updating poder:', error)
      toast.error('Error al actualizar el poder: ' + mensajeErrorInsertPoder(error))
    } finally {
      setSavingPoder(false)
    }
  }

  const handleSavePoder = async () => {
    if (poderModal.type === 'create') await handleCreatePoder()
    else if (poderModal.type === 'edit') await handleUpdatePoder()
  }

  const handleRevocarPoder = async (poderId: string) => {
    if (!confirm('¿Estás seguro de revocar este poder? Esta acción no se puede deshacer.')) {
      return
    }

    await revocarPoder(poderId)
  }

  const confirmarRevocarPoder = async () => {
    if (!revocandoPoderId) return
    setRevocando(true)
    try {
      await revocarPoder(revocandoPoderId)
      setRevocandoPoderId(null)
    } finally {
      setRevocando(false)
    }
  }

  const handleReemplazarDocumento = async () => {
    if (!reemplazandoPoderId || !archivoReemplazo) return
    if (!esDocumentoPoderValido(archivoReemplazo)) {
      toast.error('El documento debe ser PDF o Word (.doc, .docx) y máximo 2MB')
      return
    }
    setReemplazando(true)
    try {
      const ext = extensionDocPoder(archivoReemplazo)
      const path = `${params.id}/${reemplazandoPoderId}/doc${ext}`
      const { error: uploadError } = await supabase.storage
        .from('poderes-docs')
        .upload(path, archivoReemplazo, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('poderes-docs').getPublicUrl(path)
      const { error: updateError } = await supabase
        .from('poderes')
        .update({ archivo_poder: urlData.publicUrl })
        .eq('id', reemplazandoPoderId)
      if (updateError) throw updateError
      setSuccessMessage('Documento reemplazado correctamente')
      setTimeout(() => setSuccessMessage(''), 3000)
      setReemplazandoPoderId(null)
      setArchivoReemplazo(null)
      await loadPoderes()
    } catch (error: any) {
      toast.error('Error al reemplazar documento: ' + error.message)
    } finally {
      setReemplazando(false)
    }
  }

  const revocarPoder = async (poderId: string) => {
    try {
      const { error } = await supabase
        .from('poderes')
        .update({
          estado: 'revocado',
          revocado_at: new Date().toISOString()
        })
        .eq('id', poderId)

      if (error) throw error

      setSuccessMessage('Poder revocado exitosamente')
      setTimeout(() => setSuccessMessage(''), 3000)

      await loadPoderes()
      await loadResumen()
    } catch (error: any) {
      console.error('Error revoking poder:', error)
      toast.error('Error al revocar el poder: ' + error.message)
    }
  }

  const handleActivarPoderPendiente = async (poderId: string) => {
    if (!asamblea?.organization_id) return
    const poder = poderes.find((p) => p.id === poderId)
    if (!poder || poder.estado !== 'pendiente_verificacion') return

    setActivandoPoderId(poderId)
    try {
      const { data: val, error: valErr } = await supabase.rpc('validar_limite_poderes', {
        p_asamblea_id: params.id,
        p_email_receptor: poder.email_receptor,
        p_organization_id: asamblea.organization_id,
      })
      if (valErr) throw valErr
      const r = val?.[0] as { puede_recibir_poder?: boolean; mensaje?: string }
      if (!r?.puede_recibir_poder) {
        toast.error(r?.mensaje ?? 'El apoderado alcanzó el límite de poderes activos en esta asamblea.')
        return
      }

      const { error } = await supabase.from('poderes').update({ estado: 'activo' }).eq('id', poderId)
      if (error) throw error

      setSuccessMessage('Poder verificado y activado para votación')
      setTimeout(() => setSuccessMessage(''), 4000)
      toast.success('Poder activado')
      await loadPoderes()
      await loadResumen()
    } catch (error: unknown) {
      const e = error as { message?: string; code?: string }
      toast.error('No se pudo activar: ' + mensajeErrorInsertPoder(e))
    } finally {
      setActivandoPoderId(null)
    }
  }

  const matchUnidad = (u: Unidad, search: string) => {
    if (!search.trim()) return true
    if (matchesTorreUnidadSearch(u.torre, u.numero, search)) return true
    const term = search.toLowerCase().trim()
    const nom = String(u.nombre_propietario ?? '').toLowerCase()
    const em = String((u as { email_propietario?: string }).email_propietario ?? (u as { email?: string }).email ?? '').toLowerCase()
    return nom.includes(term) || em.includes(term)
  }

  const filteredOtorgantes = unidades.filter(u => matchUnidad(u, searchOtorgante))
  const filteredReceptores = unidades.filter(u => matchUnidad(u, searchReceptor))

  const filteredPoderes = poderes.filter((p) => {
    if (filtroEstadoPoder === 'activos' && p.estado !== 'activo') return false
    if (filtroEstadoPoder === 'pendientes' && p.estado !== 'pendiente_verificacion') return false
    if (filtroUnidadOtorganteId && p.unidad_otorgante_id !== filtroUnidadOtorganteId) return false
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase().trim()
    if (matchesTorreUnidadSearch(p.unidad_otorgante_torre, p.unidad_otorgante_numero, searchTerm)) return true
    if (
      matchesTorreUnidadSearch(
        p.unidad_receptor_torre,
        p.unidad_receptor_numero,
        searchTerm
      )
    )
      return true
    return (
      String(p.nombre_otorgante ?? '').toLowerCase().includes(term) ||
      String(p.email_otorgante ?? '').toLowerCase().includes(term) ||
      String(p.nombre_receptor ?? '').toLowerCase().includes(term) ||
      String(p.email_receptor ?? '').toLowerCase().includes(term)
    )
  })

  const toggleSort = (key: PoderSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection(key === 'registrado' ? 'desc' : 'asc')
  }

  const getSortIcon = (key: PoderSortKey) => {
    if (sortKey !== key) return <span className="text-[10px] opacity-70">↕</span>
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5" />
      : <ChevronDown className="w-3.5 h-3.5" />
  }

  const sortedPoderes = useMemo(() => {
    const normalizar = (v: unknown) => String(v ?? '').toLowerCase().trim()
    const estadoOrden: Record<string, number> = {
      pendiente_verificacion: 1,
      activo: 2,
      revocado: 3,
    }

    const valorOrden = (p: Poder, key: PoderSortKey): string | number => {
      switch (key) {
        case 'unidad_otorgante':
          return `${normalizar(p.unidad_otorgante_torre)}|${normalizar(p.unidad_otorgante_numero)}`
        case 'propietario':
          return `${normalizar(p.nombre_otorgante)}|${normalizar(p.email_otorgante)}`
        case 'apoderado':
          return `${normalizar(p.unidad_receptor_torre)}|${normalizar(p.unidad_receptor_numero)}|${normalizar(p.nombre_receptor)}|${normalizar(p.email_receptor)}`
        case 'coeficiente':
          return Number(p.coeficiente_delegado) || 0
        case 'documento':
          return p.archivo_poder ? 1 : 0
        case 'registrado':
          return new Date(p.created_at).getTime() || 0
        case 'estado':
          return estadoOrden[p.estado] ?? 99
        case 'acciones':
          return `${normalizar(p.estado)}|${normalizar(p.id)}`
        default:
          return ''
      }
    }

    return [...filteredPoderes].sort((a, b) => {
      const va = valorOrden(a, sortKey)
      const vb = valorOrden(b, sortKey)
      let res = 0
      if (typeof va === 'number' && typeof vb === 'number') res = va - vb
      else res = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' })
      if (res === 0) res = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return sortDirection === 'asc' ? res : -res
    })
  }, [filteredPoderes, sortDirection, sortKey])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando poderes...</p>
        </div>
      </div>
    )
  }

  if (!asamblea) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/dashboard/asambleas/${params.id}`}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Users className="w-6 h-6 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Gestión de Poderes
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {asamblea.nombre}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGuiaModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                title="Guía: tokens (créditos) y funcionalidades"
              >
                <HelpCircle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                Guía
              </button>
              <Link href="/dashboard/unidades">
                <Button
                  variant="outline"
                  className="border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Consultar Unidades
                </Button>
              </Link>
              {asamblea?.estado === 'finalizada' ? (
                <Button variant="outline" disabled className="opacity-60 cursor-not-allowed border-purple-300 dark:border-purple-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Excel
                </Button>
              ) : (
                <Link href={`/dashboard/asambleas/${params.id}/poderes/importar`}>
                  <Button
                    variant="outline"
                    className="border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Excel
                  </Button>
                </Link>
              )}
              <Button
                onClick={() => asamblea?.estado !== 'finalizada' && openCreatePoderModal()}
                disabled={asamblea?.estado === 'finalizada'}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Poder
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {asamblea?.estado === 'finalizada' && (
          <Alert className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">Asamblea cerrada</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              No puedes agregar, modificar ni revocar poderes. Reabre la asamblea desde el detalle de la asamblea para habilitar la gestión.
            </AlertDescription>
          </Alert>
        )}

        {/* Mensaje de éxito */}
        {successMessage && (
          <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-900 dark:text-green-100">Éxito</AlertTitle>
            <AlertDescription className="text-green-800 dark:text-green-200">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Resumen de Poderes */}
        {resumen && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Poderes Activos</p>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {resumen.total_poderes_activos}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unidades Delegadas</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {resumen.total_unidades_delegadas}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Coeficiente Delegado</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {resumen.coeficiente_total_delegado.toFixed(2)}%
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Límite por Apoderado</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {config.max_poderes_por_apoderado}
              </p>
            </div>
          </div>
        )}

        {/* Info sobre poderes (colapsable) */}
        <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <button
            type="button"
            onClick={() => setMostrarInfoPoderes((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
            aria-expanded={mostrarInfoPoderes}
            aria-label="Mostrar u ocultar información sobre poderes"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-900 dark:text-blue-100 m-0">
                ℹ️ Sobre los Poderes en Asambleas
              </AlertTitle>
            </div>
            {mostrarInfoPoderes
              ? <ChevronUp className="h-4 w-4 text-blue-700 dark:text-blue-300" />
              : <ChevronDown className="h-4 w-4 text-blue-700 dark:text-blue-300" />}
          </button>
          {mostrarInfoPoderes && (
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm mt-3">
              • Cada <strong>unidad que delega</strong> (apartamento que otorga el poder) solo puede tener <strong>un poder activo</strong> a la vez en esta asamblea; para cambiar de apoderado, <strong>revoca o edita</strong> el existente
              <br />
              • El <strong>mismo apoderado</strong> (persona o unidad receptora) <strong>sí puede recibir varios poderes</strong> si vienen de <strong>apartamentos distintos</strong>, hasta el límite configurado
              <br />
              • Límite actual: máximo <strong>{config.max_poderes_por_apoderado} poderes</strong> por apoderado (configurable en Configuración → Poderes)
              <br />
              • El voto del apoderado representa la suma de su coeficiente más el de todas las unidades que representa
              <br />
              • Los poderes activos se pueden <strong>editar</strong> (corregir apoderado o unidad) o revocar antes de la votación
              <br />
              • Los votantes pueden <strong>declarar un poder recibido</strong> desde «Mis datos»; queda <strong>pendiente de verificación</strong> hasta que usted lo active aquí (tras revisar documento o acta física)
            </AlertDescription>
          )}
        </Alert>

        {/* Buscador y filtros */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Torre+apto, solo apto (sin torre), nombre o correo…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:items-center">
              <select
                title="Filtrar por unidad que otorga el poder"
                value={filtroUnidadOtorganteId}
                onChange={(e) => setFiltroUnidadOtorganteId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 min-w-[200px]"
              >
                <option value="">Todas las unidades (otorgante)</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.torre || 'S/T'} — {u.numero || 'S/N'} · {u.nombre_propietario?.trim() || '—'}
                  </option>
                ))}
              </select>
              <select
                title="Filtrar por estado del poder"
                value={filtroEstadoPoder}
                onChange={(e) =>
                  setFiltroEstadoPoder(e.target.value as 'activos' | 'pendientes' | 'todos')
                }
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2"
              >
                <option value="activos">Solo vigentes</option>
                <option value="pendientes">Pendientes de verificar</option>
                <option value="todos">Todos (incl. revocados)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tip: elige “Unidad otorgante” para filtrar por apartamento; “Pendientes de verificar” para activar solicitudes enviadas desde la votación; “Todos” para auditoría.
          </p>
        </div>

        {/* Lista de Poderes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Poderes Registrados ({filteredPoderes.length})
            </h2>
          </div>

          {filteredPoderes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm.trim() ? 'No se encontraron poderes con ese criterio' : 'No hay poderes registrados'}
              </p>
              {!searchTerm.trim() && (
                <Button
                  onClick={() => openCreatePoderModal()}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Primer Poder
                </Button>
              )}
            </div>
          ) : (
            <div
              className="max-h-[min(70vh,42rem)] overflow-auto overscroll-contain border-t border-gray-100 dark:border-gray-700/80"
              title="Desplazamiento horizontal en la barra inferior de este recuadro"
            >
              <table className="w-full min-w-[960px]">
                <thead className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 shadow-sm [&_th]:bg-gray-50 dark:[&_th]:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('unidad_otorgante')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Unidad Otorgante
                        {getSortIcon('unidad_otorgante')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('propietario')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Propietario
                        {getSortIcon('propietario')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('apoderado')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Apoderado
                        {getSortIcon('apoderado')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('coeficiente')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Coeficiente
                        {getSortIcon('coeficiente')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('documento')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Documento
                        {getSortIcon('documento')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('registrado')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Registrado
                        {getSortIcon('registrado')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('estado')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Estado
                        {getSortIcon('estado')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <button type="button" onClick={() => toggleSort('acciones')} className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Acciones
                        {getSortIcon('acciones')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedPoderes.map((poder) => (
                    <tr key={poder.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {poder.unidad_otorgante_torre} - {poder.unidad_otorgante_numero}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/unidades?volver_asamblea=${params.id}&conjunto_id=${asamblea.organization_id}&editar_unidad_id=${poder.unidad_otorgante_id}`}
                          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                          title="Editar esta unidad"
                        >
                          {poder.nombre_otorgante}
                        </Link>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {poder.email_otorgante}
                        </div>
                      </td>
                      <td className="px-6 py-4 min-w-[200px]">
                        {poder.unidad_receptor_id ? (
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Unidad del apoderado
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                            Sin unidad en el conjunto (tercero)
                          </div>
                        )}
                        {poder.unidad_receptor_id && (
                          <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                            {(poder.unidad_receptor_torre && String(poder.unidad_receptor_torre).trim()) || 'S/T'} —{' '}
                            {(poder.unidad_receptor_numero && String(poder.unidad_receptor_numero).trim()) || 'S/N'}
                          </div>
                        )}
                        <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {(poder.nombre_receptor && String(poder.nombre_receptor).trim()) || '—'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                          {(poder.email_receptor && String(poder.email_receptor).trim()) || 'Sin identificador registrado'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-green-600 dark:text-green-400">
                          {poder.coeficiente_delegado.toFixed(4)}%
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {poder.archivo_poder ? (
                            <>
                              <a
                                href={poder.archivo_poder}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                              >
                                <FileText className="w-4 h-4" />
                                Ver documento
                              </a>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setReemplazandoPoderId(poder.id)
                                  setArchivoReemplazo(null)
                                }}
                                disabled={asamblea?.estado === 'finalizada'}
                                title={asamblea?.estado === 'finalizada' ? 'Asamblea cerrada' : undefined}
                              >
                                Reemplazar
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setReemplazandoPoderId(poder.id)
                                setArchivoReemplazo(null)
                              }}
                              disabled={asamblea?.estado === 'finalizada'}
                              title={asamblea?.estado === 'finalizada' ? 'Asamblea cerrada' : undefined}
                            >
                              Cargar documento
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-600 dark:text-gray-400" title="Fecha y hora de registro del poder">
                          {poder.created_at
                            ? new Date(poder.created_at).toLocaleString('es-CO', {
                                timeZone: 'America/Bogota',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {poder.estado === 'activo' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Activo
                          </span>
                        ) : poder.estado === 'pendiente_verificacion' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
                            Pendiente verificación
                          </span>
                        ) : poder.estado === 'usado' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Usado
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Revocado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {poder.estado === 'activo' && (
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                asamblea?.estado !== 'finalizada' && setPoderModal({ type: 'edit', poder })
                              }
                              disabled={asamblea?.estado === 'finalizada'}
                              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                              title={asamblea?.estado === 'finalizada' ? 'Asamblea cerrada' : 'Corregir apoderado, unidad o datos'}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => asamblea?.estado !== 'finalizada' && handleRevocarPoder(poder.id)}
                              disabled={asamblea?.estado === 'finalizada'}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title={asamblea?.estado === 'finalizada' ? 'Asamblea cerrada' : 'Revocar este poder'}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Revocar
                            </Button>
                          </div>
                        )}
                        {poder.estado === 'pendiente_verificacion' && (
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                asamblea?.estado !== 'finalizada' && handleActivarPoderPendiente(poder.id)
                              }
                              disabled={asamblea?.estado === 'finalizada' || activandoPoderId === poder.id}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              title="Validar contra documento o acta y activar para votación"
                            >
                              <ClipboardCheck className="w-4 h-4 mr-1" />
                              {activandoPoderId === poder.id ? '…' : 'Activar'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => asamblea?.estado !== 'finalizada' && handleRevocarPoder(poder.id)}
                              disabled={asamblea?.estado === 'finalizada'}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Rechazar la solicitud"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Rechazar
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal: Nuevo Poder */}
      <Dialog
        open={poderModal.type !== 'none'}
        onOpenChange={(open) => {
          if (!open) closePoderModal()
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {poderModal.type === 'edit' ? 'Editar poder registrado' : 'Registrar Nuevo Poder'}
            </DialogTitle>
            <DialogDescription>
              {poderModal.type === 'edit'
                ? 'Puedes pasar el apoderado de tercero a una unidad del conjunto (o al revés), corregir correo/nombre o cambiar la unidad que otorga, sin revocar el poder.'
                : 'Para el mismo apoderado con varias unidades que delegan: completa apoderado una vez, usa «Añadir otra unidad» por cada unidad otorgante distinta y «Registrar todo» al final. Cada unidad que delega solo puede tener un poder activo; el límite por apoderado aplica al total de poderes que recibe en la asamblea.'}
            </DialogDescription>
          </DialogHeader>

          {poderModal.type === 'create' && colaPoderes.length > 0 && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 px-3 py-2 text-sm">
              <p className="font-medium text-indigo-900 dark:text-indigo-100 mb-1">Pendientes de registrar ({colaPoderes.length})</p>
              <p className="text-xs text-indigo-700/90 dark:text-indigo-300/90 mb-2">
                Mismo apoderado: los datos del paso 2 siguen rellenos; solo cambia la unidad que otorga en el paso 1 en cada nueva fila.
              </p>
              <ul className="max-h-28 overflow-y-auto space-y-1 text-xs text-indigo-800 dark:text-indigo-200">
                {colaPoderes.map((c) => {
                  const uo = unidades.find((u) => u.id === c.unidad_otorgante_id)
                  return (
                    <li key={c.id} className="flex justify-between gap-2 items-start">
                      <span>
                        {uo ? `${uo.torre}-${uo.numero}` : 'Unidad'} → {c.nombre_receptor} ({c.email_receptor})
                      </span>
                      <button
                        type="button"
                        className="text-red-600 dark:text-red-400 shrink-0 hover:underline"
                        onClick={() => setColaPoderes((prev) => prev.filter((x) => x.id !== c.id))}
                      >
                        Quitar
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="space-y-6 mt-4">
            {/* Selección de Unidad Otorgante — key fuerza remount tras «Añadir otra unidad» para dejar el paso listo para buscar */}
            <div key={otorgantePickerNonce}>
              <Label htmlFor="search-otorgante">
                1. Unidad que Otorga el Poder <span className="text-red-500">*</span>
              </Label>
              <div className="mt-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search-otorgante"
                  type="text"
                  placeholder="Torre+número, solo número, propietario o correo…"
                  value={searchOtorgante}
                  onChange={(e) => setSearchOtorgante(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Comienza a escribir para buscar una unidad
                </p>
                <Link 
                  href="/dashboard/unidades"
                  target="_blank"
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                >
                  <Home className="w-3 h-3 mr-1" />
                  Ver todas las unidades
                </Link>
              </div>

              {selectedOtorgante ? (
                <div className="mt-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-indigo-900 dark:text-indigo-100">
                        {selectedOtorgante.torre} - {selectedOtorgante.numero}
                      </p>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        {selectedOtorgante.nombre_propietario}
                      </p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Coeficiente: {selectedOtorgante.coeficiente.toFixed(4)}%
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOtorgante(null)}
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              ) : searchOtorgante && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {filteredOtorgantes.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No se encontraron unidades
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredOtorgantes.slice(0, 10).map((unidad) => (
                        <button
                          key={unidad.id}
                          onClick={() => {
                            setSelectedOtorgante(unidad)
                            setSearchOtorgante('')
                          }}
                          className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">
                            {unidad.torre} - {unidad.numero}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {unidad.nombre_propietario} • {unidad.coeficiente.toFixed(4)}%
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Apoderado: otra unidad del conjunto o tercero (no propietario) */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold">
                2. Apoderado (quien recibe el poder) <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-wrap gap-4 mt-2 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo-apoderado"
                    checked={!apoderadoEsTercero}
                    onChange={() => {
                      setApoderadoEsTercero(false)
                      setSelectedReceptor(null)
                      setEmailReceptor('')
                      setNombreReceptor('')
                      setSearchReceptor('')
                    }}
                    className="rounded-full border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Otra unidad del conjunto</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo-apoderado"
                    checked={apoderadoEsTercero}
                    onChange={() => {
                      setApoderadoEsTercero(true)
                      setSelectedReceptor(null)
                      setSearchReceptor('')
                    }}
                    className="rounded-full border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Tercero (no es propietario de una unidad)</span>
                </label>
              </div>

              {!apoderadoEsTercero && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Selecciona la unidad del apoderado; se autollenarán correo y nombre desde el registro.
                  </p>
                  <div className="mt-2 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Torre+número, solo número, propietario o correo…"
                      value={searchReceptor}
                      onChange={(e) => setSearchReceptor(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {selectedReceptor ? (
                    <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                            {selectedReceptor.torre} - {selectedReceptor.numero}
                          </p>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            {(selectedReceptor as { nombre_propietario?: string }).nombre_propietario}
                          </p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            {(selectedReceptor as { email_propietario?: string; email?: string }).email_propietario ?? (selectedReceptor as { email?: string }).email}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReceptor(null)
                            setEmailReceptor('')
                            setNombreReceptor('')
                          }}
                        >
                          Cambiar
                        </Button>
                      </div>
                    </div>
                  ) : searchReceptor && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      {filteredReceptores.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No se encontraron unidades
                        </p>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredReceptores.slice(0, 10).map((unidad) => (
                            <button
                              key={unidad.id}
                              type="button"
                              onClick={() => {
                                const u = unidad as { nombre_propietario?: string; email_propietario?: string; email?: string }
                                setSelectedReceptor(unidad)
                                setEmailReceptor(u.email_propietario ?? u.email ?? '')
                                setNombreReceptor(u.nombre_propietario ?? '')
                                setSearchReceptor('')
                              }}
                              className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <p className="font-medium text-gray-900 dark:text-white">
                                {unidad.torre} - {unidad.numero}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {(unidad as { nombre_propietario?: string }).nombre_propietario} • {(unidad as { email_propietario?: string; email?: string }).email_propietario ?? (unidad as { email?: string }).email}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {apoderadoEsTercero && (
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                  Ingresa nombre y correo del apoderado (persona que no es propietaria de una unidad en el conjunto).
                </p>
              )}

              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="nombre-receptor">
                    Nombre del apoderado <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nombre-receptor"
                    type="text"
                    placeholder="Juan Pérez García"
                    value={nombreReceptor}
                    onChange={(e) => setNombreReceptor(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="email-receptor">
                    {apoderadoEsTercero ? 'Identificador del apoderado' : 'Email del apoderado'} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email-receptor"
                    type="text"
                    placeholder={apoderadoEsTercero ? 'apoderado@ejemplo.com, 3001234567 o 1234567890' : 'apoderado@ejemplo.com'}
                    value={emailReceptor}
                    onChange={(e) => setEmailReceptor(e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {apoderadoEsTercero ? 'Para tercero puedes usar email, teléfono o identificación. Ese dato será el que use para entrar a votar.' : 'Se autollena al elegir la unidad; puedes editarlo si hace falta.'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="observaciones">Observaciones (Opcional)</Label>
                  <textarea
                    id="observaciones"
                    placeholder="Notas adicionales sobre este poder..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Documento del poder (Opcional)</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                    PDF o Word (.doc, .docx), máximo 2MB. Puedes reemplazarlo después si lo necesitas.
                  </p>
                  <ChecklistPoderLey675 />
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) { setArchivoPoder(null); return }
                        if (!esDocumentoPoderValido(f)) {
                          toast.error('Archivo debe ser PDF o Word y máximo 2MB')
                          e.target.value = ''
                          return
                        }
                        setArchivoPoder(f)
                      }}
                      className="hidden"
                      id="archivo-poder-input"
                    />
                    <label htmlFor="archivo-poder-input" className="cursor-pointer flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      {archivoPoder ? (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {archivoPoder.name} ({(archivoPoder.size / 1024).toFixed(1)} KB)
                          <button
                            type="button"
                            onClick={(ev) => { ev.preventDefault(); setArchivoPoder(null); }}
                            className="ml-2 text-red-600 hover:underline"
                          >
                            Quitar
                          </button>
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Clic para seleccionar o arrastrar
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => closePoderModal()} disabled={savingPoder}>
                Cancelar
              </Button>
              {poderModal.type === 'create' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void agregarPoderALaCola()}
                  disabled={
                    savingPoder ||
                    asamblea?.estado === 'finalizada' ||
                    !selectedOtorgante ||
                    !emailReceptor.trim() ||
                    !nombreReceptor.trim() ||
                    (!apoderadoEsTercero && !selectedReceptor)
                  }
                  className="border-indigo-300 dark:border-indigo-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir otra unidad
                </Button>
              )}
              <Button
                onClick={() => void handleSavePoder()}
                disabled={
                  savingPoder ||
                  asamblea?.estado === 'finalizada' ||
                  (poderModal.type === 'create'
                    ? colaPoderes.length === 0 &&
                      (!selectedOtorgante ||
                        !emailReceptor.trim() ||
                        !nombreReceptor.trim() ||
                        (!apoderadoEsTercero && !selectedReceptor))
                    : !selectedOtorgante ||
                      !emailReceptor.trim() ||
                      !nombreReceptor.trim() ||
                      (!apoderadoEsTercero && !selectedReceptor))
                }
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {savingPoder ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {poderModal.type === 'edit' ? 'Guardando...' : 'Registrando...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {poderModal.type === 'edit'
                      ? 'Guardar cambios'
                      : colaPoderes.length > 0
                        ? `Registrar todo (${colaPoderes.length + (buildColaItemFromForm() ? 1 : 0)})`
                        : 'Registrar poder'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Reemplazar documento */}
      <Dialog open={!!reemplazandoPoderId} onOpenChange={(open) => {
        if (!open) { setReemplazandoPoderId(null); setArchivoReemplazo(null) }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documento del poder</DialogTitle>
            <DialogDescription>
              Sube un PDF o Word (máx. 2MB). Reemplazará el documento actual si ya existe uno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <ChecklistPoderLey675 />
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) { setArchivoReemplazo(null); return }
                  if (!esDocumentoPoderValido(f)) {
                    toast.error('Archivo debe ser PDF o Word y máximo 2MB')
                    e.target.value = ''
                    return
                  }
                  setArchivoReemplazo(f)
                }}
                className="hidden"
                id="archivo-reemplazo-input"
              />
              <label htmlFor="archivo-reemplazo-input" className="cursor-pointer flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                {archivoReemplazo ? (
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {archivoReemplazo.name} ({(archivoReemplazo.size / 1024).toFixed(1)} KB)
                    <button
                      type="button"
                      onClick={(ev) => { ev.preventDefault(); setArchivoReemplazo(null); }}
                      className="ml-2 text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </span>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">Seleccionar archivo</span>
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReemplazandoPoderId(null); setArchivoReemplazo(null) }} disabled={reemplazando}>
                Cancelar
              </Button>
              <Button onClick={handleReemplazarDocumento} disabled={!archivoReemplazo || reemplazando || asamblea?.estado === 'finalizada'}>
                {reemplazando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo confirmación revocar poder */}
      <Dialog open={!!revocandoPoderId} onOpenChange={(open) => !open && setRevocandoPoderId(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>¿Revocar este poder?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El apoderado dejará de poder votar por la unidad que le otorgó el poder.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setRevocandoPoderId(null)} disabled={revocando}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmarRevocarPoder}
              disabled={revocando}
            >
              {revocando ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Revocando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Revocar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <GuiaTokensModal open={guiaModalOpen} onOpenChange={setGuiaModalOpen} />
    </div>
  )
}
