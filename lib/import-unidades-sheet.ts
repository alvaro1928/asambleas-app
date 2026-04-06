/**
 * Parseo robusto de filas Excel/CSV para importación de unidades (censo).
 * Soporta variantes de nombres de columna, espacios, tildes y encabezados no estándar.
 */

/** Quita BOM y espacios extremos de claves (CSV UTF-8 con BOM). */
export function cleanHeaderKey(key: string): string {
  return key.replace(/^\uFEFF/, '').trim()
}

/** Normaliza encabezado para comparar: minúsculas, sin tildes, solo letras/números/espacio. */
export function normalizeHeaderKey(key: string): string {
  return cleanHeaderKey(key)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cellString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return Number.isInteger(value) ? String(value) : String(value)
  }
  return String(value).trim()
}

/** Primera celda no vacía entre claves exactas. */
export function cellExact(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    const s = cellString(v)
    if (s !== '') return s
  }
  return ''
}

/**
 * Como cellExact, pero si no hay coincidencia de clave literal, busca columnas cuyo encabezado
 * normalizado coincida (ej. `Numero` sin tilde ↔ `Número`, espacios/BOM).
 */
export function cellFlexible(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    const s = cellString(v)
    if (s !== '') return s
  }
  const wanted = new Set(
    keys.map((k) => normalizeHeaderKey(cleanHeaderKey(k))).filter((x) => x.length > 0)
  )
  if (wanted.size === 0) return ''
  for (const [rawKey, v] of Object.entries(row)) {
    if (rawKey.startsWith('__')) continue
    const s = cellString(v)
    if (s === '') continue
    const nk = normalizeHeaderKey(cleanHeaderKey(rawKey))
    if (wanted.has(nk)) return s
  }
  return ''
}

const TORRE_EXACT: string[] = [
  'torre',
  'Torre',
  'TORRE',
  'bloque',
  'Bloque',
  'BLOQUE',
  'Torre/Bloque',
  'Torre / Bloque',
  'Edificio',
  'edificio',
  'Fase',
  'fase',
  'Etapa',
  'etapa',
  'Sector',
  'sector',
  'Manzana',
  'manzana',
  'Grupo',
  'grupo',
]

const NUMERO_EXACT: string[] = [
  'numero',
  'Numero',
  'NUMERO',
  'unidad',
  'Unidad',
  'UNIDAD',
  'Unidad (Apto/Casa)',
  'Unidad(Apto/Casa)',
  'Número',
  'Número unidad',
  'Número de unidad',
  'Numero de unidad',
  'Nº Unidad',
  'N° Unidad',
  'Nº',
  'N°',
  'Apartamento',
  'apartamento',
  'APTO',
  'Apto',
  'No. Unidad',
  'No Unidad',
  'Interno',
  'interno',
  'Vivienda',
  'vivienda',
  'Inmueble',
  'inmueble',
  'Ubicación',
  'Ubicacion',
  'ubicacion',
  'Código unidad',
  'Codigo unidad',
  'ID unidad',
  'Id unidad',
]

const COEF_EXACT: string[] = [
  'coeficiente',
  'Coeficiente',
  'COEFICIENTE',
  'coef',
  'Coef',
  'COEF',
  'Coef.',
  'Participación',
  'Participacion',
  'participacion',
  'Prorrateo',
  'prorrateo',
  'Fracción',
  'Fraccion',
  'fraccion',
  'ppm',
  'PPM',
  '%',
]

const TIPO_EXACT: string[] = ['tipo', 'Tipo', 'TIPO', 'Clase', 'clase', 'Clasificación', 'Clasificacion']

const NOMBRE_EXACT: string[] = [
  'Nombre Propietario',
  'propietario',
  'Propietario',
  'PROPIETARIO',
  'Nombre',
  'Propietario(s)',
  'Copropietario',
  'copropietario',
  'Titular',
  'titular',
]

const EMAIL_EXACT: string[] = [
  'email',
  'Email',
  'EMAIL',
  'correo',
  'Correo',
  'CORREO',
  'Correo electrónico',
  'correo electrónico',
  'Correo electronico',
  'E-mail',
  'e-mail',
  'Correos',
  'Mail',
  'mail',
]

const TELEFONO_EXACT: string[] = [
  'telefono',
  'Telefono',
  'Teléfono',
  'TELEFONO',
  'Tel',
  'Celular',
  'celular',
  'Móvil',
  'Movil',
  'movil',
  'Whatsapp',
  'WhatsApp',
]

function isExcludedNumeroColumn(nk: string): boolean {
  if (!nk) return true
  if (/telefono|tel |celular|movil|whatsapp|fax/.test(nk)) return true
  if (/correo|email|e mail|mail /.test(nk)) return true
  if (/nombre|propietario|titular|copropietario|residente|arrendatario/.test(nk)) return true
  if (/coeficiente|participacion|prorrateo|fraccion|ppm/.test(nk)) return true
  if (/documento|cedula|cc |nit|nit |pasaporte/.test(nk)) return true
  if (/numero.*(documento|cedula|nit|telefono|tel|factura|orden|radicado)/.test(nk)) return true
  if (/direccion|barrio|ciudad|municipio|departamento|pais|zona/.test(nk)) return true
  if (/observacion|nota|comentario|descripcion/.test(nk)) return true
  if (/area|m2|metros|parqueadero|cuota|valor|precio|saldo/.test(nk)) return true
  return false
}

function scoreNumeroColumn(nk: string): number {
  if (isExcludedNumeroColumn(nk)) return 0
  if (nk.includes('unidad') && (nk.includes('apto') || nk.includes('casa') || nk.includes('inmueble'))) return 12
  if (nk === 'unidad' || nk.startsWith('unidad ')) return 11
  if (nk.includes('apartamento') || nk === 'apto' || nk.startsWith('apto ')) return 10
  if (nk === 'numero' || nk === 'nro' || nk === 'no' || nk.startsWith('numero ')) return 9
  if (nk.includes('n ') && nk.includes('unidad')) return 8
  if (/\bn[ºo°]\b/.test(nk) || nk.includes('nº') || nk.includes('n°')) return 8
  if (nk.includes('interno')) return 7
  if (nk.includes('vivienda') || nk.includes('inmueble')) return 6
  if (nk.includes('casa') && !nk.includes('coeficiente')) return 5
  if (nk.includes('codigo') && (nk.includes('unidad') || nk.includes('apto'))) return 9
  if (nk.includes('identificador') && nk.includes('unidad')) return 8
  return 0
}

function isExcludedTorreColumn(nk: string): boolean {
  if (!nk) return true
  if (/correo|email|mail|telefono|celular|movil/.test(nk)) return true
  if (/coeficiente|participacion|prorrateo|fraccion/.test(nk)) return true
  if (/propietario|nombre|titular/.test(nk)) return true
  if (isExcludedNumeroColumn(nk) && !/torre|bloque|edificio|fase|etapa|sector|manzana|grupo/.test(nk)) return true
  return false
}

function scoreTorreColumn(nk: string): number {
  if (isExcludedTorreColumn(nk)) return 0
  if (/torre|bloque|edificio|fase|etapa|sector|manzana|grupo|cluster|edif/.test(nk)) return 8
  return 0
}

function isExcludedCoefColumn(nk: string): boolean {
  if (!nk) return true
  if (/telefono|correo|email|nombre|propietario|titular|direccion/.test(nk)) return true
  if (/unidad|apto|apartamento|numero|interno|vivienda|inmueble|casa/.test(nk) && !/coeficiente|participacion|prorrateo|porcentaje|ppm|fraccion/.test(nk)) {
    return true
  }
  return false
}

function scoreCoefColumn(nk: string): number {
  if (isExcludedCoefColumn(nk)) return 0
  if (nk.includes('coeficiente')) return 12
  if (nk.includes('participacion') || nk.includes('prorrateo')) return 11
  if (nk.includes('fraccion') || nk === 'ppm') return 9
  if (nk.includes('porcentaje') || nk === '%') return 8
  if (nk === 'coef' || nk.startsWith('coef ')) return 7
  return 0
}

function pickByScore(
  row: Record<string, unknown>,
  scoreFn: (nk: string) => number
): string {
  let bestVal = ''
  let bestScore = 0
  for (const [rawKey, val] of Object.entries(row)) {
    if (rawKey.startsWith('__')) continue
    const s = cellString(val)
    if (s === '') continue
    const nk = normalizeHeaderKey(cleanHeaderKey(rawKey))
    const sc = scoreFn(nk)
    if (sc > bestScore) {
      bestScore = sc
      bestVal = s
    }
  }
  return bestVal
}

export interface ExtractedUnidadImportRow {
  torre: string
  numero: string
  coeficienteStr: string
  tipo: string
  nombre_propietario: string
  email: string
  telefono: string
}

/** Duplica valores bajo claves sin BOM y sin espacios raros (CSV UTF-8). */
function rowWithCleanKeys(row: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(row)) {
    const ck = cleanHeaderKey(k)
    if (ck !== k && merged[ck] === undefined) merged[ck] = v
  }
  return merged
}

/**
 * Extrae campos de una fila usando claves exactas y, si faltan, coincidencia por nombre de columna normalizado.
 */
export function extractUnidadImportRow(row: Record<string, unknown>): ExtractedUnidadImportRow {
  const rowClean = rowWithCleanKeys(row)

  let torre = cellFlexible(rowClean, ...TORRE_EXACT)
  if (!torre) torre = pickByScore(rowClean, scoreTorreColumn)

  let numero = cellFlexible(rowClean, ...NUMERO_EXACT)
  if (!numero) numero = pickByScore(rowClean, scoreNumeroColumn)

  let coeficienteStr = cellFlexible(rowClean, ...COEF_EXACT)
  if (!coeficienteStr) coeficienteStr = pickByScore(rowClean, scoreCoefColumn)

  let tipo = cellFlexible(rowClean, ...TIPO_EXACT)
  if (!tipo) {
    const t = pickByScore(rowClean, (nk) => {
      if (/tipo|clase|clasificacion/.test(nk) && !/propietario|unidad|coeficiente/.test(nk)) return 6
      return 0
    })
    tipo = t || 'apartamento'
  }

  let nombre_propietario = cellFlexible(rowClean, ...NOMBRE_EXACT)
  if (!nombre_propietario) {
    nombre_propietario = pickByScore(rowClean, (nk) => {
      if (/nombre|propietario|titular|copropietario|residente/.test(nk) && !/unidad|numero|coeficiente/.test(nk)) return 8
      return 0
    })
  }

  let email = cellFlexible(rowClean, ...EMAIL_EXACT)
  if (!email) {
    email = pickByScore(rowClean, (nk) => {
      if (/correo|email|^e mail$|^mail$/.test(nk)) return 10
      return 0
    })
  }

  let telefono = cellFlexible(rowClean, ...TELEFONO_EXACT)
  if (!telefono) {
    telefono = pickByScore(rowClean, (nk) => {
      if (/telefono|tel|celular|movil|whatsapp/.test(nk)) return 10
      return 0
    })
  }

  return {
    torre,
    numero,
    coeficienteStr,
    tipo: tipo || 'apartamento',
    nombre_propietario,
    email,
    telefono,
  }
}

/** Fila sin datos útiles (ignora metadatos tipo __rowNum__). */
export function filaSinDatosImport(row: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('__')) continue
    if (v == null) continue
    if (typeof v === 'number' && !Number.isNaN(v)) return false
    if (cellString(v) !== '') return false
  }
  return true
}
