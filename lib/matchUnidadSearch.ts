/**
 * Búsqueda por torre + número alineada con `/dashboard/unidades`:
 * - Texto con o sin espacios/guiones ("10 301" → también "10301" sobre torre+número).
 * - Si no hay torre en datos (o placeholder S/T en UI), el último token del texto
 *   suele coincidir con el número de unidad (p. ej. "Apto 301").
 */
export type MatchUnidadSearchOptions = {
  /** Si true, trata "S/T", "S/N" como vacío (listas que sustituyen null por etiquetas). */
  displaySentinels?: boolean
}

function normalizeTorre(raw: string | null | undefined, displaySentinels: boolean): string {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!displaySentinels) return s
  if (!s || s === 's/t' || s === 's/t —' || s === 's/t -') return ''
  return s
}

function normalizeNumero(raw: string | number | null | undefined, displaySentinels: boolean): string {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!displaySentinels) return s
  if (!s || s === 's/n') return ''
  return s
}

export function matchesTorreUnidadSearch(
  torreRaw: string | null | undefined,
  numeroRaw: string | number | null | undefined,
  searchRaw: string,
  options?: MatchUnidadSearchOptions
): boolean {
  const displaySentinels = options?.displaySentinels === true
  const term = searchRaw.toLowerCase().trim()
  if (!term) return true
  const termSinSeparadores = term.replace(/[\s\-]/g, '')
  const torre = normalizeTorre(torreRaw, displaySentinels)
  const numero = normalizeNumero(numeroRaw, displaySentinels)
  const torreNumero = torre + numero
  const tokens = term.split(/\s+/).filter(Boolean)
  const lastTok = (tokens[tokens.length - 1] || '').replace(/[\s\-]/g, '')

  if (numero.includes(term) || torre.includes(term)) return true
  if (termSinSeparadores.length > 0 && torreNumero.includes(termSinSeparadores)) return true
  if (!torre && lastTok.length > 0 && (numero === lastTok || numero.includes(lastTok))) return true
  return false
}

/** Torre/número + nombre o email del propietario (modales de asistencia, etc.). */
export function matchesUnidadBusquedaCompleta(
  u: {
    torre?: string | null
    numero?: string | number | null
    nombre_propietario?: string | null
    email_propietario?: string | null
  },
  search: string,
  options?: MatchUnidadSearchOptions
): boolean {
  if (!search.trim()) return true
  if (matchesTorreUnidadSearch(u.torre, u.numero, search, options)) return true
  const term = search.toLowerCase().trim()
  const nom = String(u.nombre_propietario ?? '').toLowerCase()
  const em = String(u.email_propietario ?? '').toLowerCase()
  return nom.includes(term) || em.includes(term)
}
