'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sumaCoeficientesValida, rangoCoeficientesAceptado } from '@/lib/coeficientes'
import ConjuntoSelector from '@/components/ConjuntoSelector'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/components/providers/ToastProvider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Download,
  Trash2,
} from 'lucide-react'

interface Unidad {
  torre?: string
  numero: string
  coeficiente: number
  tipo: string
  nombre_propietario?: string
  email?: string
  telefono?: string
}

export default function ImportarUnidadesPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState<'excel' | 'csv' | null>(null)
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [unidadesExistentes, setUnidadesExistentes] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Estadísticas (Ley 675: suma 100% con tolerancia por redondeo)
  const totalCoeficientes = unidades.reduce((sum, u) => sum + u.coeficiente, 0)
  const coeficientesCorrecto = sumaCoeficientesValida(totalCoeficientes)
  const diferencia = totalCoeficientes - 100

  const handleCancelPreview = () => {
    setShowPreview(false)
    setUnidades([])
    setFileName('')
    setFileType(null)
    setError('')
  }

  /** Obtiene el organization_id del conjunto donde importar: el seleccionado en el header o el primero del usuario. */
  const getOrganizationIdForImport = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const selectedId = typeof window !== 'undefined' ? localStorage.getItem('selectedConjuntoId') : null
    if (selectedId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', selectedId)
        .limit(1)
        .maybeSingle()
      if (profile?.organization_id) return profile.organization_id
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return profile?.organization_id ?? null
  }

  // Cargar cantidad de unidades existentes del conjunto seleccionado (y al cambiar de conjunto)
  useEffect(() => {
    checkExistingUnits()
    const onStorage = () => { checkExistingUnits() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount and storage only; checkExistingUnits uses getOrganizationIdForImport
  }, [])

  const checkExistingUnits = async () => {
    try {
      const orgId = await getOrganizationIdForImport()
      if (!orgId) return

      const { count } = await supabase
        .from('unidades')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      setUnidadesExistentes(count || 0)
    } catch (error) {
      console.error('Error checking existing units:', error)
    }
  }

  const handleDeleteAll = async () => {
    setDeleting(true)
    setError('')

    try {
      const orgId = await getOrganizationIdForImport()
      if (!orgId) {
        throw new Error('Selecciona un conjunto en el selector del header o crea uno.')
      }

      // Eliminar todas las unidades del conjunto seleccionado
      const { error: deleteError } = await supabase
        .from('unidades')
        .delete()
        .eq('organization_id', orgId)

      if (deleteError) {
        throw new Error('Error al eliminar las unidades: ' + deleteError.message)
      }

      // Actualizar contador
      setUnidadesExistentes(0)
      setShowDeleteConfirm(false)
      
      // Mostrar mensaje de éxito
      toast.success('Todas las unidades han sido eliminadas. Ahora puedes importar nuevamente.')

    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al eliminar las unidades')
    } finally {
      setDeleting(false)
    }
  }

  const processData = (jsonData: any[]) => {
    const unidadesProcesadas: Unidad[] = []
    const unidadesVistas = new Set<string>() // Cambiado: ahora guarda torre+numero
    const errores: string[] = []

    jsonData.forEach((row, index) => {
      const rowNum = index + 2

      // Validar campos requeridos
      if (!row.numero && !row.Numero && !row.NUMERO && !row.unidad && !row.Unidad && !row.UNIDAD) {
        errores.push(`Fila ${rowNum}: Falta el número de unidad`)
        return
      }

      if (!row.coeficiente && !row.Coeficiente && !row.COEFICIENTE) {
        errores.push(`Fila ${rowNum}: Falta el coeficiente`)
        return
      }

      // Obtener valores (soportar diferentes casos)
      const torre = (row.torre || row.Torre || row.TORRE || row.bloque || row.Bloque || row.BLOQUE || '').toString().trim()
      const numero = String(
        row.numero || row.Numero || row.NUMERO || 
        row.unidad || row.Unidad || row.UNIDAD
      ).trim()
      
      const coeficienteStr = String(row.coeficiente || row.Coeficiente || row.COEFICIENTE)
      const coeficiente = parseFloat(coeficienteStr.replace(',', '.'))

      // Validar duplicado: torre + numero
      const unidadKey = `${torre}|${numero}` // Torre A + 101 vs Torre B + 101
      if (unidadesVistas.has(unidadKey)) {
        const torreDisplay = torre ? `Torre "${torre}" - ` : ''
        errores.push(`Fila ${rowNum}: ${torreDisplay}Unidad "${numero}" duplicada`)
        return
      }
      unidadesVistas.add(unidadKey)

      // Validar coeficiente numérico
      if (isNaN(coeficiente) || coeficiente <= 0) {
        errores.push(`Fila ${rowNum}: Coeficiente inválido "${coeficienteStr}"`)
        return
      }

      // Tipo: normalizar a minúsculas para evitar violar check en BD (Apartamento -> apartamento, Apto -> apto, etc.)
      const tipoRaw = row.tipo ?? row.Tipo ?? row.TIPO ?? 'apartamento'
      const tipo = String(tipoRaw).trim().toLowerCase() || 'apartamento'

      // Agregar unidad
      unidadesProcesadas.push({
        torre: torre || undefined,
        numero,
        coeficiente,
        tipo,
        nombre_propietario: row['Nombre Propietario'] || row.propietario || row.Propietario || row.PROPIETARIO || '',
        email: row.email || row.Email || row.EMAIL || '',
        telefono: row.telefono || row.Telefono || row['Teléfono'] || row.TELEFONO || '',
      })
    })

    return { unidadesProcesadas, errores }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    setFileName(file.name)
    setFileType(extension === 'csv' ? 'csv' : 'excel')
    setError('')
    setUnidades([])
    setShowPreview(false)
    
    // Resetear el input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = ''

    try {
      let jsonData: any[] = []

      if (extension === 'csv') {
        // Procesar CSV
        const text = await file.text()
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
        })
        jsonData = result.data
      } else {
        // Procesar Excel
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data)
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        jsonData = XLSX.utils.sheet_to_json(worksheet)
      }

      const { unidadesProcesadas, errores } = processData(jsonData)

      if (errores.length > 0) {
        setError(`Errores encontrados:\n${errores.join('\n')}`)
        return
      }

      if (unidadesProcesadas.length === 0) {
        setError('El archivo no contiene datos válidos')
        return
      }

      setUnidades(unidadesProcesadas)
      setShowPreview(true)

    } catch (error: any) {
      console.error('Error reading file:', error)
      setError(`Error al leer el archivo: ${error.message}`)
    }
  }

  const handleImport = async () => {
    setLoading(true)
    setError('')

    try {
      const orgId = await getOrganizationIdForImport()
      if (!orgId) {
        throw new Error('Selecciona un conjunto en el selector del header o crea uno.')
      }

      // Verificar duplicados solo en ESTE conjunto (torre + numero por organization_id)
      const { data: existingUnits } = await supabase
        .from('unidades')
        .select('torre, numero')
        .eq('organization_id', orgId)

      const existingKeys = new Set(
        existingUnits?.map(u => `${u.torre || ''}|${u.numero}`) || []
      )
      
      const duplicados = unidades.filter(u => 
        existingKeys.has(`${u.torre || ''}|${u.numero}`)
      )

      if (duplicados.length > 0) {
        const duplicadosList = duplicados.map(u => 
          u.torre ? `Torre ${u.torre} - ${u.numero}` : u.numero
        ).join(', ')
        throw new Error(`Las siguientes unidades ya existen en este conjunto: ${duplicadosList}`)
      }

      // Insertar unidades en el conjunto seleccionado
      const unidadesConOrg = unidades.map(u => ({
        ...u,
        organization_id: orgId,
      }))

      const { error: insertError } = await supabase
        .from('unidades')
        .insert(unidadesConOrg)

      if (insertError) {
        console.error('Error inserting units:', insertError)
        throw new Error('Error al guardar las unidades: ' + insertError.message)
      }

      // Actualizar contador de unidades existentes
      setUnidadesExistentes(unidadesExistentes + unidades.length)
      router.push('/dashboard?success=unidades-importadas')

    } catch (error: any) {
      console.error('Error:', error)
      setError(error.message || 'Error al importar las unidades')
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Torre/Bloque': 'A',
        'Unidad (Apto/Casa)': '101',
        'Coeficiente': '0.5234',
        'Tipo': 'Apartamento',
        'Nombre Propietario': 'Juan Pérez',
        'Email': 'juan@email.com',
        'Teléfono': '3001234567',
      },
      {
        'Torre/Bloque': 'A',
        'Unidad (Apto/Casa)': '102',
        'Coeficiente': '0.4766',
        'Tipo': 'Apartamento',
        'Nombre Propietario': 'María López',
        'Email': 'maria@email.com',
        'Teléfono': '3007654321',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
    XLSX.writeFile(wb, 'plantilla-unidades.xlsx')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Importación Masiva de Coeficientes
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Carga tu base de datos de copropiedad en segundos
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <ConjuntoSelector onConjuntoChange={checkExistingUnits} />
              <div className="flex items-center space-x-3">
                {unidadesExistentes > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {unidadesExistentes} unidades cargadas
                    </span>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpiar Base de Datos
                    </Button>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Plantilla
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modal de Confirmación */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    ¿Eliminar todas las unidades?
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </div>

              <Alert variant="warning" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Se eliminarán <strong>{unidadesExistentes} unidades</strong> de forma permanente.
                  Tendrás que importarlas nuevamente desde cero.
                </AlertDescription>
              </Alert>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAll}
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
                      Sí, Eliminar Todo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Upload Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="space-y-6">
              {/* Info Alert */}
              <Alert variant="info">
                <Info className="h-4 w-4" />
                <AlertTitle>Formatos Soportados</AlertTitle>
                <AlertDescription>
                  Puedes cargar archivos Excel (.xlsx, .xls) o CSV (.csv). Descarga la plantilla para ver el formato correcto.
                </AlertDescription>
              </Alert>

              {/* File Input */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center hover:border-indigo-500 dark:hover:border-indigo-400 transition-all">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={loading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="space-y-4">
                    {fileName ? (
                      <FileSpreadsheet className="mx-auto h-16 w-16 text-indigo-500" />
                    ) : (
                      <Upload className="mx-auto h-16 w-16 text-gray-400" />
                    )}
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {fileName || 'Selecciona un archivo'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Excel (.xlsx, .xls) o CSV (.csv)
                      </p>
                      {fileType && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                          Tipo detectado: {fileType === 'csv' ? 'CSV' : 'Excel'}
                        </p>
                      )}
                    </div>
                  </div>
                </label>
              </div>

              {/* Formato requerido */}
              <Alert variant="default">
                <Info className="h-4 w-4" />
                <AlertTitle>Columnas Requeridas</AlertTitle>
                <AlertDescription>
                  <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto">
                    <div className="grid grid-cols-7 gap-3 font-bold mb-2 min-w-max">
                      <div>torre</div>
                      <div>numero</div>
                      <div>coeficiente*</div>
                      <div>tipo</div>
                      <div>propietario</div>
                      <div>email</div>
                      <div>telefono</div>
                    </div>
                    <div className="grid grid-cols-7 gap-3 text-gray-600 dark:text-gray-400 min-w-max">
                      <div>A</div>
                      <div>101</div>
                      <div>0.5234</div>
                      <div>apartamento</div>
                      <div>Juan Pérez</div>
                      <div>juan@email.com</div>
                      <div>3001234567</div>
                    </div>
                  </div>
                  <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                    * Campos requeridos: <strong>numero</strong> y <strong>coeficiente</strong>
                  </p>
                </AlertDescription>
              </Alert>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Error al procesar el archivo</AlertTitle>
                  <AlertDescription className="whitespace-pre-line mt-2">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Botón para intentar de nuevo si hay error */}
              {error && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleCancelPreview}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Cargar Otro Archivo
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Preview Card */}
          {showPreview && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <FileSpreadsheet className="w-6 h-6 mr-2 text-indigo-600" />
                Vista Previa de Importación
              </h2>

              {/* Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Unidades</p>
                      <p className="text-4xl font-bold text-blue-900 dark:text-blue-300 mt-2">
                        {unidades.length}
                      </p>
                    </div>
                    <FileSpreadsheet className="w-12 h-12 text-blue-400 opacity-50" />
                  </div>
                </div>

                <div className={`rounded-xl p-6 border ${
                  coeficientesCorrecto
                    ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
                    : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        coeficientesCorrecto
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        Suma Coeficientes
                      </p>
                      <p className={`text-4xl font-bold mt-2 ${
                        coeficientesCorrecto
                          ? 'text-green-900 dark:text-green-300'
                          : 'text-red-900 dark:text-red-300'
                      }`}>
                        {totalCoeficientes.toFixed(2)}%
                      </p>
                    </div>
                    {coeficientesCorrecto ? (
                      <CheckCircle2 className="w-12 h-12 text-green-400" />
                    ) : (
                      <XCircle className="w-12 h-12 text-red-400" />
                    )}
                  </div>
                </div>

                <div className={`rounded-xl p-6 border ${
                  coeficientesCorrecto
                    ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
                    : 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        coeficientesCorrecto
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        Validación Ley 675
                      </p>
                      <p className={`text-2xl font-bold mt-2 ${
                        coeficientesCorrecto
                          ? 'text-green-900 dark:text-green-300'
                          : 'text-yellow-900 dark:text-yellow-300'
                      }`}>
                        {coeficientesCorrecto ? '✓ Aprobado' : '⚠ Pendiente'}
                      </p>
                    </div>
                    {coeficientesCorrecto ? (
                      <CheckCircle2 className="w-12 h-12 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-12 h-12 text-yellow-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Validación Ley 675 */}
              {!coeficientesCorrecto && (
                <Alert variant="warning" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validación de Coeficientes (Ley 675 de 2001)</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      <p>La suma total de coeficientes debe estar <strong>{rangoCoeficientesAceptado()}</strong> (Ley 675; se acepta un pequeño margen por redondeo).</p>
                      <p>Suma actual: <strong>{totalCoeficientes.toFixed(6)}%</strong></p>
                      <p className="text-lg font-semibold">
                        Diferencia: <span className={diferencia > 0 ? 'text-red-600' : 'text-blue-600'}>
                          {diferencia > 0 ? '+' : ''}{diferencia.toFixed(6)}%
                        </span>
                      </p>
                      <p className="text-xs mt-2">
                        Por favor, ajusta los coeficientes en tu archivo antes de importar.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Torre</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Coeficiente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Propietario</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unidades.slice(0, 10).map((unidad, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{unidad.torre || '-'}</TableCell>
                        <TableCell className="font-semibold">{unidad.numero}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {unidad.coeficiente.toFixed(6)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                            {unidad.tipo}
                          </span>
                        </TableCell>
                        <TableCell>{unidad.nombre_propietario || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {unidad.email || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {unidades.length > 10 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                  Mostrando 10 de {unidades.length} unidades. Todas serán importadas.
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={handleCancelPreview}
                  disabled={loading}
                  className="order-2 sm:order-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Cargar Otro Archivo
                </Button>
                
                <div className="flex space-x-4 order-1 sm:order-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelPreview}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || !coeficientesCorrecto}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmar e Importar {unidades.length} Unidades
                    </>
                  )}
                </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
