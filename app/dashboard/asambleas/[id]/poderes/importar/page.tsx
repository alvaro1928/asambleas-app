'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
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
  Download,
} from 'lucide-react'

interface PoderRow {
  torre: string
  numero: string
  email_apoderado: string
  nombre_apoderado: string
  observaciones?: string
  unidad_id?: string
  email_otorgante?: string
  nombre_otorgante?: string
  error?: string
}

export default function ImportarPoderesPage({ params }: { params: { id: string } }) {
  const toast = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState<'excel' | 'csv' | null>(null)
  const [rows, setRows] = useState<PoderRow[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [asambleaNombre, setAsambleaNombre] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    loadAsamblea()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
  }, [params.id])

  const loadAsamblea = async () => {
    try {
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        router.push('/dashboard')
        return
      }
      const { data, error: err } = await supabase
        .from('asambleas')
        .select('id, nombre, organization_id')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()
      if (err || !data) {
        router.push('/dashboard/asambleas')
        return
      }
      setAsambleaNombre(data.nombre)
      setOrganizationId(data.organization_id)
    } catch {
      router.push('/dashboard/asambleas')
    }
  }

  const processData = (jsonData: any[]): { rows: PoderRow[]; errores: string[] } => {
    const rowsProcesados: PoderRow[] = []
    const errores: string[] = []

    jsonData.forEach((row, index) => {
      const rowNum = index + 2
      const torre = String(row.torre || row.Torre || row.TORRE || row['Torre/Bloque'] || row.bloque || '').trim()
      const numero = String(
        row.numero || row.Numero || row['Unidad (Apto/Casa)'] || row.unidad || row.Unidad || row.Número || ''
      ).trim()
      const emailApoderado = String(
        row['Email apoderado'] || row.email_apoderado || row.email_apoderado || row['Email Apoderado'] || row.email || ''
      ).trim()
      const nombreApoderado = String(
        row['Nombre apoderado'] || row.nombre_apoderado || row['Nombre Apoderado'] || row.nombre_receptor || row.apoderado || ''
      ).trim()
      const observaciones = String(row.observaciones || row.Observaciones || '').trim() || undefined

      if (!numero) {
        errores.push(`Fila ${rowNum}: Falta el número de unidad`)
        return
      }
      if (!emailApoderado || !emailApoderado.includes('@')) {
        errores.push(`Fila ${rowNum}: Email del apoderado inválido`)
        return
      }

      rowsProcesados.push({
        torre: torre || '',
        numero,
        email_apoderado: emailApoderado.toLowerCase(),
        nombre_apoderado: nombreApoderado || emailApoderado,
        observaciones,
      })
    })

    return { rows: rowsProcesados, errores }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    setFileName(file.name)
    setFileType(extension === 'csv' ? 'csv' : 'excel')
    setError('')
    setRows([])
    setShowPreview(false)
    e.target.value = ''

    try {
      let jsonData: any[] = []

      if (extension === 'csv') {
        const text = await file.text()
        const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false })
        jsonData = result.data as any[]
      } else {
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data)
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        jsonData = XLSX.utils.sheet_to_json(worksheet)
      }

      const { rows: rowsProcesados, errores } = processData(jsonData)

      if (errores.length > 0) {
        setError(`Errores:\n${errores.join('\n')}`)
        return
      }

      if (rowsProcesados.length === 0) {
        setError('El archivo no contiene filas válidas')
        return
      }

      setRows(rowsProcesados)
      setShowPreview(true)
    } catch (err: any) {
      setError('Error al leer el archivo: ' + (err.message || ''))
    }
  }

  const handleImport = async () => {
    if (!organizationId || rows.length === 0) return

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay usuario autenticado')

      const unidadesByKey = new Map<string, { id: string; email: string; nombre_propietario: string }>()
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, torre, numero, email, nombre_propietario')
        .eq('organization_id', organizationId)

      unidadesData?.forEach((u: any) => {
        const key = `${u.torre || ''}|${u.numero}`
        unidadesByKey.set(key, {
          id: u.id,
          email: u.email || '',
          nombre_propietario: u.nombre_propietario || '',
        })
      })

      const { data: poderesExistentes } = await supabase
        .from('poderes')
        .select('unidad_otorgante_id')
        .eq('asamblea_id', params.id)
        .eq('estado', 'activo')

      const unidadesConPoder = new Set(poderesExistentes?.map((p: any) => p.unidad_otorgante_id) || [])

      const toInsert: Array<{
        asamblea_id: string
        unidad_otorgante_id: string
        email_otorgante: string
        nombre_otorgante: string
        email_receptor: string
        nombre_receptor: string
        observaciones: string | null
        estado: string
      }> = []
      const errores: string[] = []

      for (const row of rows) {
        const key = `${row.torre}|${row.numero}`
        const unidad = unidadesByKey.get(key)
        if (!unidad) {
          errores.push(`Unidad no encontrada: ${row.torre ? row.torre + ' - ' : ''}${row.numero}`)
          continue
        }
        if (unidadesConPoder.has(unidad.id)) {
          errores.push(`La unidad ${row.torre ? row.torre + ' - ' : ''}${row.numero} ya tiene un poder registrado`)
          continue
        }
        toInsert.push({
          asamblea_id: params.id,
          unidad_otorgante_id: unidad.id,
          email_otorgante: unidad.email || '',
          nombre_otorgante: unidad.nombre_propietario || '',
          email_receptor: row.email_apoderado,
          nombre_receptor: row.nombre_apoderado,
          observaciones: row.observaciones || null,
          estado: 'activo',
        })
        unidadesConPoder.add(unidad.id)
      }

      if (errores.length > 0) {
        setError(errores.slice(0, 10).join('\n') + (errores.length > 10 ? `\n... y ${errores.length - 10} más` : ''))
        setLoading(false)
        return
      }

      if (toInsert.length === 0) {
        setError('No hay filas válidas para importar')
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase.from('poderes').insert(toInsert)

      if (insertError) throw insertError

      toast.success(`Se importaron ${toInsert.length} poder(es) correctamente.`)
      router.push(`/dashboard/asambleas/${params.id}/poderes`)
    } catch (err: any) {
      setError(err.message || 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Torre/Bloque': 'A',
        'Unidad (Apto/Casa)': '101',
        'Email apoderado': 'apoderado@email.com',
        'Nombre apoderado': 'María García',
        'Observaciones': '',
      },
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Poderes')
    XLSX.writeFile(wb, 'plantilla-poderes.xlsx')
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setRows([])
    setFileName('')
    setFileType(null)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link
              href={`/dashboard/asambleas/${params.id}/poderes`}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Importar poderes
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{asambleaNombre}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Columnas esperadas</AlertTitle>
          <AlertDescription>
            Torre/Bloque, Unidad (Apto/Casa), Email apoderado, Nombre apoderado. Opcional: Observaciones.
            Las unidades deben existir en el conjunto y no tener ya un poder en esta asamblea.
          </AlertDescription>
        </Alert>

        {!showPreview ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Arrastra un archivo Excel o CSV aquí, o haz clic para seleccionar
              </span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
              />
            </label>
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Descargar plantilla
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <FileSpreadsheet className="inline w-4 h-4 mr-2" />
                {fileName} — {rows.length} fila(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancelPreview}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading ? 'Importando...' : `Importar ${rows.length} poder(es)`}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Torre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Email apoderado</TableHead>
                    <TableHead>Nombre apoderado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.torre || '—'}</TableCell>
                      <TableCell>{row.numero}</TableCell>
                      <TableCell>{row.email_apoderado}</TableCell>
                      <TableCell>{row.nombre_apoderado}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && (
                <p className="p-4 text-sm text-gray-500">
                  ... y {rows.length - 50} filas más
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
