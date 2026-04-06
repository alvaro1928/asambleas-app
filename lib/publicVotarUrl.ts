/**
 * Prefijo de la app bajo el dominio (p. ej. `/asamblea`) cuando la URL real es
 * `/asamblea/dashboard/...`, `/asamblea/votar/...` o `/asamblea/asistir/...`.
 */
export function getPublicAppBasePath(): string {
  if (typeof window === 'undefined') return ''
  const { pathname } = window.location
  const dashboardIdx = pathname.indexOf('/dashboard')
  if (dashboardIdx > 0) return pathname.slice(0, dashboardIdx)
  const votarIdx = pathname.indexOf('/votar/')
  if (votarIdx > 0) return pathname.slice(0, votarIdx)
  const asistirIdx = pathname.indexOf('/asistir/')
  if (asistirIdx > 0) return pathname.slice(0, asistirIdx)
  const regPoderIdx = pathname.indexOf('/registrar-poder/')
  if (regPoderIdx > 0) return pathname.slice(0, regPoderIdx)
  return ''
}

/**
 * URL pública de votación coherente con la ruta real del sitio.
 *
 * Si el dashboard se abre bajo un prefijo (p. ej. `/asamblea/dashboard/...`), el QR y los
 * enlaces deben usar `origin + prefijo + /votar/:codigo`. Si solo confiamos en
 * `NEXT_PUBLIC_SITE_URL`, puede quedar un prefijo de más o de menos respecto al despliegue
 * (proxy, subcarpeta, dominio distinto) y el escaneo del QR lleva a otra ruta que devuelve error.
 */
export function buildPublicVotarUrl(codigoAcceso: string): string {
  const code = String(codigoAcceso || '').trim()
  if (!code) return ''

  if (typeof window !== 'undefined') {
    const { origin } = window.location
    const basePath = getPublicAppBasePath()
    return `${origin}${basePath}/votar/${encodeURIComponent(code)}`
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '') || 'https://www.asamblea.online'
  return `${siteUrl}/votar/${encodeURIComponent(code)}`
}

/** Enlace público de asistente delegado (mismo criterio de prefijo que `buildPublicVotarUrl`). */
/** URL pública para declarar poderes sin abrir votación (mismo prefijo base que /votar). */
export function buildPublicRegistroPoderUrl(codigoAcceso: string): string {
  const code = String(codigoAcceso || '').trim()
  if (!code) return ''

  if (typeof window !== 'undefined') {
    const { origin } = window.location
    const basePath = getPublicAppBasePath()
    return `${origin}${basePath}/registrar-poder/${encodeURIComponent(code)}`
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '') || 'https://www.asamblea.online'
  return `${siteUrl}/registrar-poder/${encodeURIComponent(code)}`
}

export function buildPublicAsistirUrl(codigoAcceso: string, tokenDelegado: string): string {
  const code = String(codigoAcceso || '').trim()
  const tok = String(tokenDelegado || '').trim()
  if (!code || !tok) return ''

  if (typeof window !== 'undefined') {
    const { origin } = window.location
    const basePath = getPublicAppBasePath()
    return `${origin}${basePath}/asistir/${encodeURIComponent(code)}?t=${encodeURIComponent(tok)}`
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '') || 'https://www.asamblea.online'
  return `${siteUrl}/asistir/${encodeURIComponent(code)}?t=${encodeURIComponent(tok)}`
}
