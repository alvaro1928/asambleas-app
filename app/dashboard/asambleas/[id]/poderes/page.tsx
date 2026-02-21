'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Plus, 
  Trash2,
  Search,
  FileText,
  Users,
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

interface Asamblea {
  id: string
  nombre: string
  fecha: string
  estado: string
  organization_id: string
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

const MAX_DOC_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const DOC_MIME_ALLOWED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

function isValidDocFile(file: File): boolean {
  return file.size <= MAX_DOC_SIZE_BYTES && DOC_MIME_ALLOWED.includes(file.type)
}

function getDocExtension(file: File): string {
  if (file.name.toLowerCase().endsWith('.pdf')) return '.pdf'
  if (file.name.toLowerCase().endsWith('.doc')) return '.doc'
  return '.docx'
}

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

  // Estados para el modal de nuevo poder
  const [showNewPoder, setShowNewPoder] = useState(false)
  const [searchOtorgante, setSearchOtorgante] = useState('')
  const [searchReceptor, setSearchReceptor] = useState('')
  const [selectedOtorgante, setSelectedOtorgante] = useState<Unidad | null>(null)
  const [selectedReceptor, setSelectedReceptor] = useState<Unidad | null>(null)
  const [emailReceptor, setEmailReceptor] = useState('')
  const [nombreReceptor, setNombreReceptor] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [archivoPoder, setArchivoPoder] = useState<File | null>(null)
  const [savingPoder, setSavingPoder] = useState(false)

  // Reemplazar documento
  const [reemplazandoPoderId, setReemplazandoPoderId] = useState<string | null>(null)
  const [archivoReemplazo, setArchivoReemplazo] = useState<File | null>(null)
  const [reemplazando, setReemplazando] = useState(false)

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [revocandoPoderId, setRevocandoPoderId] = useState<string | null>(null)
  const [revocando, setRevocando] = useState(false)
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

      // Cargar asamblea
      const { data: asambleaData, error: asambleaError } = await supabase
        .from('asambleas')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()

      if (asambleaError) throw asambleaError
      setAsamblea(asambleaData)

      // Cargar unidades del conjunto
      const { data: unidadesData, error: unidadesError } = await supabase
        .from('unidades')
        .select('*')
        .eq('organization_id', selectedConjuntoId)
        .order('torre', { ascending: true })
        .order('numero', { ascending: true })

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

  const handleCreatePoder = async () => {
    if (!selectedOtorgante) {
      toast.error('Debes seleccionar la unidad que otorga el poder')
      return
    }

    if (!selectedReceptor) {
      toast.error('Debes seleccionar la unidad que recibe el poder (apoderado)')
      return
    }

    if (!emailReceptor.trim()) {
      toast.error('Debes ingresar el email del apoderado')
      return
    }

    if (!nombreReceptor.trim()) {
      toast.error('Debes ingresar el nombre del apoderado')
      return
    }

    // Validar límite de poderes
    try {
      const { data: validacion, error: validacionError } = await supabase.rpc('validar_limite_poderes', {
        p_asamblea_id: params.id,
        p_email_receptor: emailReceptor.trim(),
        p_organization_id: asamblea?.organization_id
      })

      if (validacionError) {
        console.error('Error validando límite:', validacionError)
      } else if (validacion && validacion.length > 0) {
        const resultado = validacion[0]
        if (!resultado.puede_recibir_poder) {
          toast.error(`${resultado.mensaje}. El apoderado ya tiene ${resultado.poderes_actuales} poderes activos (límite: ${resultado.limite_maximo})`)
          return
        }
      }
    } catch (error) {
      console.error('Error en validación:', error)
    }

    if (archivoPoder && !isValidDocFile(archivoPoder)) {
      toast.error('El documento debe ser PDF o Word (.doc, .docx) y máximo 2MB')
      return
    }

    const emailOtorgante = (selectedOtorgante as { email?: string; email_propietario?: string }).email_propietario ?? (selectedOtorgante as { email?: string }).email ?? ''
    setSavingPoder(true)
    try {
      const { data: newPoder, error } = await supabase
        .from('poderes')
        .insert({
          asamblea_id: params.id,
          unidad_otorgante_id: selectedOtorgante.id,
          unidad_receptor_id: selectedReceptor?.id ?? null,
          email_otorgante: emailOtorgante,
          nombre_otorgante: selectedOtorgante.nombre_propietario,
          email_receptor: emailReceptor.trim(),
          nombre_receptor: nombreReceptor.trim(),
          observaciones: observaciones.trim() || null,
          estado: 'activo'
        })
        .select('id')
        .single()

      if (error) throw error

      if (archivoPoder && newPoder) {
        const ext = getDocExtension(archivoPoder)
        const path = `${params.id}/${newPoder.id}/doc${ext}`
        const { error: uploadError } = await supabase.storage
          .from('poderes-docs')
          .upload(path, archivoPoder, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('poderes-docs').getPublicUrl(path)
          await supabase.from('poderes').update({ archivo_poder: urlData.publicUrl }).eq('id', newPoder.id)
        }
      }

      setSuccessMessage('Poder registrado exitosamente')
      setTimeout(() => setSuccessMessage(''), 3000)
      setShowNewPoder(false)
      setSelectedOtorgante(null)
      setSelectedReceptor(null)
      setEmailReceptor('')
      setNombreReceptor('')
      setObservaciones('')
      setArchivoPoder(null)
      setSearchOtorgante('')
      setSearchReceptor('')
      
      await loadPoderes()
      await loadResumen()
    } catch (error: any) {
      console.error('Error creating poder:', error)
      toast.error('Error al crear el poder: ' + error.message)
    } finally {
      setSavingPoder(false)
    }
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
    if (!isValidDocFile(archivoReemplazo)) {
      toast.error('El documento debe ser PDF o Word (.doc, .docx) y máximo 2MB')
      return
    }
    setReemplazando(true)
    try {
      const ext = getDocExtension(archivoReemplazo)
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

  const filteredOtorgantes = unidades.filter(u =>
    !searchOtorgante ||
    u.numero.toLowerCase().includes(searchOtorgante.toLowerCase()) ||
    u.torre.toLowerCase().includes(searchOtorgante.toLowerCase()) ||
    u.nombre_propietario.toLowerCase().includes(searchOtorgante.toLowerCase())
  )
  const filteredReceptores = unidades.filter(u => {
    if (!searchReceptor) return true
    const num = (u as { numero?: string }).numero ?? ''
    const torre = (u as { torre?: string }).torre ?? ''
    const nom = (u as { nombre_propietario?: string }).nombre_propietario ?? ''
    const em = (u as { email?: string; email_propietario?: string }).email_propietario ?? (u as { email?: string }).email ?? ''
    const q = searchReceptor.toLowerCase()
    return num.toLowerCase().includes(q) || torre.toLowerCase().includes(q) || nom.toLowerCase().includes(q) || em.toLowerCase().includes(q)
  })

  const filteredPoderes = poderes.filter(p =>
    p.estado === 'activo' && (
      !searchTerm ||
      p.nombre_otorgante.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nombre_receptor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unidad_otorgante_numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email_receptor.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

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
                title="Guía: tokens y funcionalidades"
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
              <Link href={`/dashboard/asambleas/${params.id}/poderes/importar`}>
                <Button
                  variant="outline"
                  className="border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Excel
                </Button>
              </Link>
              <Button
                onClick={() => setShowNewPoder(true)}
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

        {/* Info sobre regulación */}
        <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            ℹ️ Sobre los Poderes en Asambleas
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
            • Un propietario puede otorgar un <strong>poder</strong> a otra persona para que vote en su nombre
            <br />
            • Límite actual: máximo <strong>{config.max_poderes_por_apoderado} poderes</strong> por apoderado (configurable)
            <br />
            • El voto del apoderado representa la suma de su coeficiente más el de todas las unidades que representa
            <br />
            • Los poderes se pueden revocar antes de la votación
          </AlertDescription>
        </Alert>

        {/* Buscador */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por unidad, propietario o apoderado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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
                {searchTerm ? 'No se encontraron poderes con ese criterio' : 'No hay poderes registrados'}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setShowNewPoder(true)}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Primer Poder
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Unidad Otorgante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Propietario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Apoderado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Coeficiente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Registrado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPoderes.map((poder) => (
                    <tr key={poder.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {poder.unidad_otorgante_torre} - {poder.unidad_otorgante_numero}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {poder.nombre_otorgante}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {poder.email_otorgante}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {poder.nombre_receptor}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {poder.email_receptor}
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
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Revocado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {poder.estado === 'activo' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevocarPoder(poder.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Revocar este poder"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Revocar
                          </Button>
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
      <Dialog open={showNewPoder} onOpenChange={setShowNewPoder}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Poder</DialogTitle>
            <DialogDescription>
              Selecciona la unidad que otorga el poder y los datos del apoderado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Selección de Unidad Otorgante */}
            <div>
              <Label htmlFor="search-otorgante">
                1. Unidad que Otorga el Poder <span className="text-red-500">*</span>
              </Label>
              <div className="mt-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search-otorgante"
                  type="text"
                  placeholder="Buscar por torre, número o propietario..."
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

            {/* Unidad que recibe el poder (apoderado): seleccionar por unidad y autollenar correo/nombre */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold">
                2. Unidad que recibe el poder (apoderado) <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Selecciona la unidad del apoderado; se autollenarán correo y nombre desde el registro de la unidad.
              </p>
              <div className="mt-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Buscar por torre, número o propietario..."
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
                    Email del apoderado <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email-receptor"
                    type="email"
                    placeholder="apoderado@ejemplo.com"
                    value={emailReceptor}
                    onChange={(e) => setEmailReceptor(e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Se autollena al elegir la unidad; puedes editarlo si hace falta.
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
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) { setArchivoPoder(null); return }
                        if (!isValidDocFile(f)) {
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
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewPoder(false)
                  setSelectedOtorgante(null)
                  setSelectedReceptor(null)
                  setEmailReceptor('')
                  setNombreReceptor('')
                  setObservaciones('')
                  setArchivoPoder(null)
                  setSearchOtorgante('')
                  setSearchReceptor('')
                }}
                disabled={savingPoder}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreatePoder}
                disabled={savingPoder || !selectedOtorgante || !selectedReceptor || !emailReceptor.trim() || !nombreReceptor.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {savingPoder ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Registrar Poder
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Documento del poder</DialogTitle>
            <DialogDescription>
              Sube un PDF o Word (máx. 2MB). Reemplazará el documento actual si ya existe uno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) { setArchivoReemplazo(null); return }
                  if (!isValidDocFile(f)) {
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
              <Button onClick={handleReemplazarDocumento} disabled={!archivoReemplazo || reemplazando}>
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
