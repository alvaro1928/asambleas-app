'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
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
  AlertTriangle,
  Download,
  BookOpen,
} from 'lucide-react'
import {
  mensajeErrorInsertPoder,
  emailContactoUnidad,
  normalizarEmailReceptor,
  validarLimiteReceptoresLote,
} from '@/lib/poderes-registro'

type TipoApoderadoImport = 'unidad' | 'tercero'

interface PoderRow {
  torre_otorga: string
  numero_otorga: string
  tipo_apoderado: TipoApoderadoImport
  torre_recibe: string
  numero_recibe: string
  identificador_apoderado: string
  nombre_apoderado: string
  observaciones?: string
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** Normaliza texto de columna "Tipo apoderado" */
function parseTipoApoderado(raw: string): TipoApoderadoImport | null {
  const t = raw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!t) return null
  if (['tercero', 'externo', 't', '3', 'sin unidad', 'no unidad'].includes(t)) return 'tercero'
  if (['unidad', 'u', 'conjunto', 'propietario'].includes(t)) return 'unidad'
  return null
}

function inferirTipoApoderado(
  tipoExplicito: TipoApoderadoImport | null,
  numeroRecibe: string,
  identificadorTercero: string,
  nombreTercero: string
): { tipo: TipoApoderadoImport; error?: string } {
  if (tipoExplicito) return { tipo: tipoExplicito }
  const tieneUnidad = numeroRecibe.trim().length > 0
  const tieneTercero = identificadorTercero.trim().length > 0 && nombreTercero.trim().length > 0
  if (tieneUnidad && tieneTercero) {
    return {
      tipo: 'unidad',
      error:
        'Defina "Tipo apoderado" (unidad o tercero): la fila tiene unidad receptora e identificador/nombre de tercero a la vez.',
    }
  }
  if (tieneUnidad) return { tipo: 'unidad' }
  if (tieneTercero) return { tipo: 'tercero' }
  return { tipo: 'unidad', error: 'Indique unidad receptora (torre/número) o bien identificador y nombre del apoderado tercero.' }
}

function processData(jsonData: unknown[]): { rows: PoderRow[]; errores: string[] } {
  const rowsProcesados: PoderRow[] = []
  const errores: string[] = []

  jsonData.forEach((raw, index) => {
    const row = raw as Record<string, unknown>
    const rowNum = index + 2

    const torreOtorga = cell(row, 'Torre otorga', 'torre_otorga', 'torre_otorgante', 'Torre otorgante')
    const numeroOtorga = cell(
      row,
      'Número otorga',
      'numero_otorga',
      'numero_otorgante',
      'Número otorgante',
      'Numero otorga',
      'Unidad (otorga)'
    )
    const torreRecibe = cell(row, 'Torre recibe', 'torre_recibe', 'torre_receptor', 'Torre/Bloque recibe', 'Torre receptora')
    const numeroRecibe = cell(
      row,
      'Número recibe',
      'numero_recibe',
      'numero_receptor',
      'Número receptora',
      'Unidad (recibe)',
      'Unidad (Apto/Casa)',
      'unidad'
    )
    const tipoRaw = cell(row, 'Tipo apoderado', 'tipo_apoderado', 'Tipo', 'tipo')
    const tipoExplicito = tipoRaw ? parseTipoApoderado(tipoRaw) : null
    if (tipoRaw && !tipoExplicito) {
      errores.push(
        `Fila ${rowNum}: "Tipo apoderado" no reconocido ("${tipoRaw}"). Use: unidad, tercero, externo.`
      )
      return
    }
    const identificadorTercero = cell(
      row,
      'Identificador apoderado',
      'identificador_apoderado',
      'Email apoderado',
      'email_apoderado',
      'Identificador',
      'identificador'
    )
    const nombreTercero = cell(row, 'Nombre apoderado', 'nombre_apoderado', 'Nombre del apoderado')
    const observaciones = cell(row, 'Observaciones', 'observaciones') || undefined

    if (!numeroOtorga) {
      errores.push(`Fila ${rowNum}: Falta número de unidad que otorga el poder`)
      return
    }

    const inferido = inferirTipoApoderado(tipoExplicito, numeroRecibe, identificadorTercero, nombreTercero)
    if (inferido.error) {
      errores.push(`Fila ${rowNum}: ${inferido.error}`)
      return
    }
    const tipo = inferido.tipo

    if (tipo === 'unidad') {
      if (!numeroRecibe) {
        errores.push(
          `Fila ${rowNum}: Apoderado por unidad — falta "Número recibe" (y torre si aplica). O use tipo "tercero" con identificador y nombre.`
        )
        return
      }
    } else {
      if (!identificadorTercero) {
        errores.push(`Fila ${rowNum}: Apoderado tercero — falta "Identificador apoderado" (email, teléfono o documento con el que votará).`)
        return
      }
      if (!nombreTercero) {
        errores.push(`Fila ${rowNum}: Apoderado tercero — falta "Nombre apoderado".`)
        return
      }
    }

    rowsProcesados.push({
      torre_otorga: torreOtorga,
      numero_otorga: numeroOtorga,
      tipo_apoderado: tipo,
      torre_recibe: torreRecibe,
      numero_recibe: numeroRecibe,
      identificador_apoderado: identificadorTercero,
      nombre_apoderado: nombreTercero,
      observaciones,
    })
  })

  return { rows: rowsProcesados, errores }
}

function pickSheetName(sheetNames: string[]): string {
  const exact = sheetNames.find((n) => n.trim().toLowerCase() === 'poderes')
  if (exact) return exact
  return sheetNames[0] ?? 'Sheet1'
}

export default function ImportarPoderesPage({ params }: { params: { id: string } }) {
  const toast = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<PoderRow[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [asambleaNombre, setAsambleaNombre] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [asambleaFinalizada, setAsambleaFinalizada] = useState(false)

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
        .select('id, nombre, organization_id, estado')
        .eq('id', params.id)
        .eq('organization_id', selectedConjuntoId)
        .single()
      if (err || !data) {
        router.push('/dashboard/asambleas')
        return
      }
      setAsambleaNombre(data.nombre)
      setOrganizationId(data.organization_id)
      setAsambleaFinalizada(data.estado === 'finalizada')
    } catch {
      router.push('/dashboard/asambleas')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (asambleaFinalizada) {
      toast.error('La asamblea está cerrada; no se pueden importar poderes.')
      e.target.value = ''
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    setFileName(file.name)
    setError('')
    setRows([])
    setShowPreview(false)
    e.target.value = ''

    try {
      let jsonData: unknown[] = []

      if (extension === 'csv') {
        const text = await file.text()
        const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false })
        jsonData = result.data as unknown[]
      } else {
        const XLSX = await import('xlsx')
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data)
        const sheetName = pickSheetName(workbook.SheetNames)
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          setError('No se encontró ninguna hoja en el archivo.')
          return
        }
        jsonData = XLSX.utils.sheet_to_json(worksheet)
      }

      const filas = jsonData.filter((r) => {
        if (!r || typeof r !== 'object') return false
        const o = r as Record<string, unknown>
        return Object.values(o).some((v) => v != null && String(v).trim() !== '')
      })

      if (filas.length === 0) {
        setError('El archivo no tiene filas con datos (después de la fila de encabezados).')
        return
      }

      const { rows: rowsProcesados, errores } = processData(filas)

      if (errores.length > 0) {
        setError(`Errores:\n${errores.slice(0, 25).join('\n')}${errores.length > 25 ? `\n... y ${errores.length - 25} más` : ''}`)
        return
      }

      if (rowsProcesados.length === 0) {
        setError('No quedaron filas válidas para importar.')
        return
      }

      setRows(rowsProcesados)
      setShowPreview(true)
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : ''
      setError('Error al leer el archivo: ' + m)
    }
  }

  const handleImport = async () => {
    if (!organizationId || rows.length === 0 || asambleaFinalizada) return

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay usuario autenticado')

      const unidadesByKey = new Map<
        string,
        { id: string; email_propietario: string | null; email: string | null; nombre_propietario: string | null }
      >()
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, torre, numero, email_propietario, email, nombre_propietario')
        .eq('organization_id', organizationId)

      unidadesData?.forEach((u) => {
        const key = `${(u.torre || '').toString().trim()}|${(u.numero || '').toString().trim()}`
        unidadesByKey.set(key, {
          id: u.id,
          email_propietario: u.email_propietario,
          email: u.email,
          nombre_propietario: u.nombre_propietario,
        })
      })

      const { data: poderesActivos } = await supabase
        .from('poderes')
        .select('unidad_otorgante_id, email_receptor')
        .eq('asamblea_id', params.id)
        .eq('estado', 'activo')

      const clavesPoderExistentes = new Set(
        (poderesActivos ?? []).map(
          (p: { unidad_otorgante_id: string; email_receptor: string }) =>
            `${p.unidad_otorgante_id}|${normalizarEmailReceptor(p.email_receptor)}`
        )
      )

      const toInsert: Array<{
        asamblea_id: string
        unidad_otorgante_id: string
        unidad_receptor_id: string | null
        email_otorgante: string
        nombre_otorgante: string
        email_receptor: string
        nombre_receptor: string
        observaciones: string | null
        estado: string
      }> = []
      const errores: string[] = []
      const clavesEnLote = new Set<string>()

      for (const row of rows) {
        const keyOtorga = `${row.torre_otorga}|${row.numero_otorga}`
        const unidadOtorgante = unidadesByKey.get(keyOtorga)
        if (!unidadOtorgante) {
          errores.push(
            `Unidad que otorga no encontrada: ${row.torre_otorga ? row.torre_otorga + ' - ' : ''}${row.numero_otorga}`
          )
          continue
        }

        const emailOt = emailContactoUnidad(unidadOtorgante)
        let unidadReceptorId: string | null = null
        let emailRec: string
        let nombreRec: string

        if (row.tipo_apoderado === 'tercero') {
          emailRec = row.identificador_apoderado.trim()
          nombreRec = row.nombre_apoderado.trim()
        } else {
          const keyRecibe = `${row.torre_recibe}|${row.numero_recibe}`
          const unidadReceptor = unidadesByKey.get(keyRecibe)
          if (!unidadReceptor) {
            errores.push(
              `Unidad que recibe no encontrada: ${row.torre_recibe ? row.torre_recibe + ' - ' : ''}${row.numero_recibe}`
            )
            continue
          }
          emailRec = emailContactoUnidad(unidadReceptor)
          nombreRec = unidadReceptor.nombre_propietario?.trim() || ''
          unidadReceptorId = unidadReceptor.id
          if (!emailRec.trim()) {
            errores.push(
              `Unidad receptora ${row.torre_recibe ? row.torre_recibe + ' - ' : ''}${row.numero_recibe}: falta email o identificador en el registro de la unidad`
            )
            continue
          }
        }

        const claveUnica = `${unidadOtorgante.id}|${normalizarEmailReceptor(emailRec)}`
        if (clavesPoderExistentes.has(claveUnica)) {
          errores.push(
            `Ya existe un poder activo desde ${row.torre_otorga ? row.torre_otorga + ' - ' : ''}${row.numero_otorga} hacia el mismo apoderado (${emailRec})`
          )
          continue
        }
        if (clavesEnLote.has(claveUnica)) {
          errores.push(
            `Fila duplicada en el archivo: misma unidad otorgante y mismo apoderado (${row.torre_otorga ? row.torre_otorga + ' - ' : ''}${row.numero_otorga} → ${emailRec})`
          )
          continue
        }
        clavesEnLote.add(claveUnica)
        toInsert.push({
          asamblea_id: params.id,
          unidad_otorgante_id: unidadOtorgante.id,
          unidad_receptor_id: unidadReceptorId,
          email_otorgante: emailOt,
          nombre_otorgante: unidadOtorgante.nombre_propietario?.trim() || '',
          email_receptor: emailRec,
          nombre_receptor: nombreRec,
          observaciones: row.observaciones || null,
          estado: 'activo',
        })
      }

      if (errores.length > 0) {
        setError(errores.slice(0, 12).join('\n') + (errores.length > 12 ? `\n... y ${errores.length - 12} más` : ''))
        setLoading(false)
        return
      }

      if (toInsert.length === 0) {
        setError('No hay filas válidas para importar')
        setLoading(false)
        return
      }

      const lim = await validarLimiteReceptoresLote(
        supabase,
        params.id,
        organizationId,
        toInsert.map((r) => ({ email_receptor: r.email_receptor }))
      )
      if (!lim.ok) {
        setError(lim.mensaje)
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase.from('poderes').insert(toInsert)

      if (insertError) throw new Error(mensajeErrorInsertPoder(insertError))

      toast.success(`Se importaron ${toInsert.length} poder(es) correctamente.`)
      router.push(`/dashboard/asambleas/${params.id}/poderes`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')

    const headers = [
      'Torre otorga',
      'Número otorga',
      'Tipo apoderado',
      'Torre recibe',
      'Número recibe',
      'Identificador apoderado',
      'Nombre apoderado',
      'Observaciones',
    ]

    const wb = XLSX.utils.book_new()
    const wsPoderes = XLSX.utils.aoa_to_sheet([headers])
    XLSX.utils.book_append_sheet(wb, wsPoderes, 'Poderes')

    const ejemplos = [
      headers,
      ['A', '101', 'unidad', 'A', '102', '', '', 'Delega el apto 101 al propietario del 102'],
      ['B', '305', 'tercero', '', '', '3001234567', 'María Gómez Ruiz', 'Apoderado sin unidad en el conjunto'],
    ]
    const wsEj = XLSX.utils.aoa_to_sheet(ejemplos)
    XLSX.utils.book_append_sheet(wb, wsEj, 'Ejemplos')

    const nota = [
      ['Guía rápida'],
      [''],
      ['Hoja "Poderes": deje solo sus filas de datos (puede borrar la fila en blanco).'],
      ['Hoja "Ejemplos": referencia; no la suba o bórrela antes de importar si está en el mismo archivo.'],
      [''],
      ['Tipo apoderado = unidad  → complete Torre/Número recibe; deje vacíos identificador y nombre apoderado.'],
      ['Tipo apoderado = tercero → deje vacíos Torre/Número recibe; complete identificador (email/tel/doc) y nombre.'],
      [''],
      ['Si omite "Tipo apoderado", se infiere: hay número recibe = unidad; hay identificador+nombre sin unidad = tercero.'],
    ]
    const wsGuia = XLSX.utils.aoa_to_sheet(nota)
    XLSX.utils.book_append_sheet(wb, wsGuia, 'Guía')

    XLSX.writeFile(wb, 'plantilla-importar-poderes.xlsx')
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setRows([])
    setFileName('')
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importar poderes</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{asambleaNombre}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {asambleaFinalizada && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">Asamblea cerrada</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              No se pueden importar poderes. Reabre la asamblea desde el detalle para habilitar la importación.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <p className="font-semibold text-gray-900 dark:text-white">Estructura del archivo (CSV o Excel)</p>
              <p>
                Primera fila: encabezados. Se lee la hoja <strong className="text-indigo-700 dark:text-indigo-300">Poderes</strong>{' '}
                si existe; si no, la primera hoja.
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/80">
                <table className="w-full text-xs sm:text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80">
                      <th className="text-left p-2 font-medium">Columna</th>
                      <th className="text-left p-2 font-medium">Obligatorio</th>
                      <th className="text-left p-2 font-medium">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    <tr>
                      <td className="p-2 font-mono text-indigo-700 dark:text-indigo-300">Torre otorga</td>
                      <td className="p-2">Según conjunto</td>
                      <td className="p-2">Unidad que delega. Vacío si en su conjunto no usan torre.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-indigo-700 dark:text-indigo-300">Número otorga</td>
                      <td className="p-2">Sí</td>
                      <td className="p-2">Número de apartamento/casa que otorga el poder.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-indigo-700 dark:text-indigo-300">Tipo apoderado</td>
                      <td className="p-2">Recomendado</td>
                      <td className="p-2">
                        <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">unidad</code> (apoderado es otro apto) o{' '}
                        <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">tercero</code> (persona sin unidad). Si lo omite,
                        se deduce por las demás columnas.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-indigo-700 dark:text-indigo-300">Torre / Número recibe</td>
                      <td className="p-2">Si tipo = unidad</td>
                      <td className="p-2">Unidad del apoderado en el conjunto. Vacíos si tipo = tercero.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-indigo-700 dark:text-indigo-300">Identificador apoderado</td>
                      <td className="p-2">Si tipo = tercero</td>
                      <td className="p-2">Email, teléfono o documento con el que votará (igual que en registro manual).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-indigo-700 dark:text-indigo-300">Nombre apoderado</td>
                      <td className="p-2">Si tipo = tercero</td>
                      <td className="p-2">Nombre completo del apoderado.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-indigo-700 dark:text-indigo-300">Observaciones</td>
                      <td className="p-2">No</td>
                      <td className="p-2">Opcional.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-lg bg-white/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 p-3">
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">Ejemplo — apoderado = unidad</p>
                  <pre className="font-mono text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {`Torre otorga: A
Número otorga: 101
Tipo apoderado: unidad
Torre recibe: A
Número recibe: 102
Identificador: (vacío)
Nombre apoderado: (vacío)`}
                  </pre>
                </div>
                <div className="rounded-lg bg-white/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 p-3">
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">Ejemplo — apoderado = tercero</p>
                  <pre className="font-mono text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {`Torre otorga: B
Número otorga: 305
Tipo apoderado: tercero
Torre / Número recibe: (vacíos)
Identificador: 3001234567
Nombre apoderado: María Gómez Ruiz`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Reglas al importar</AlertTitle>
          <AlertDescription className="text-sm space-y-2">
            <p>
              No puede repetirse la misma combinación <strong>unidad que otorga</strong> + <strong>mismo identificador de apoderado</strong>{' '}
              mientras el poder siga activo. Varios apartamentos pueden delegar en la misma persona (hasta el límite por apoderado).
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Descargue la plantilla: incluye hoja <strong>Poderes</strong> (solo encabezados), <strong>Ejemplos</strong> (dos filas) y{' '}
              <strong>Guía</strong> (texto breve).
            </p>
          </AlertDescription>
        </Alert>

        {!showPreview ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <label
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-colors ${
                asambleaFinalizada
                  ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {asambleaFinalizada ? 'Importación deshabilitada' : 'Arrastra Excel o CSV aquí, o haz clic para seleccionar'}
              </span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                disabled={asambleaFinalizada}
                onChange={handleFileUpload}
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={downloadTemplate} disabled={asambleaFinalizada}>
                <Download className="w-4 h-4 mr-2" />
                Descargar plantilla (3 hojas)
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                  disabled={loading || asambleaFinalizada}
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
                    <TableHead>Otorga</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Apoderado (unidad o tercero)</TableHead>
                    <TableHead>Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">
                        {(row.torre_otorga || '—') + ' · ' + row.numero_otorga}
                      </TableCell>
                      <TableCell>
                        {row.tipo_apoderado === 'tercero' ? (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">Tercero</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Unidad</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.tipo_apoderado === 'tercero' ? (
                          <div className="text-sm">
                            <div className="font-mono text-xs">{row.identificador_apoderado}</div>
                            <div className="text-gray-600 dark:text-gray-400">{row.nombre_apoderado}</div>
                          </div>
                        ) : (
                          <span>
                            {(row.torre_recibe || '—') + ' · ' + row.numero_recibe}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate" title={row.observaciones}>
                        {row.observaciones || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && <p className="p-4 text-sm text-gray-500">... y {rows.length - 50} filas más</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
