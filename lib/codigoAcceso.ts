/**
 * Normaliza el código de acceso leído desde la URL.
 *
 * Algunos lectores de QR en móviles introducen guiones Unicode (–, —, −) en lugar del
 * guión ASCII (-), o espacios invisibles; el valor ya no coincide con `codigo_acceso` en BD.
 */
export function normalizeCodigoAccesoFromUrl(raw: string | string[] | undefined | null): string {
  if (raw == null) return ''
  let s = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw)
  if (!s) return ''
  try {
    s = decodeURIComponent(s)
  } catch {
    // segmento ya decodificado o parcial
  }
  s = s.normalize('NFKC')
  // Guiones / menos tipográficos → ASCII '-'
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D]/g, '-')
  // Espacios y zero-width
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '')
  s = s.replace(/\s+/g, '')
  return s.trim().toUpperCase()
}
