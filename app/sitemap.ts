import { MetadataRoute } from 'next'

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const u = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    if (u.startsWith('http')) return u
    return `https://${u}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'https://asambleas.online'
}

/** Rutas públicas (acceso sin sesión): landing, login, registro, legal, contacto, pago-ok. */
const PUBLIC_PATHS = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/login', changeFrequency: 'monthly' as const, priority: 0.9 },
  { path: '/auth/register', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/auth/restablecer', changeFrequency: 'monthly' as const, priority: 0.5 },
  { path: '/politica-privacidad', changeFrequency: 'yearly' as const, priority: 0.4 },
  { path: '/epbco', changeFrequency: 'yearly' as const, priority: 0.4 },
  { path: '/pago-ok', changeFrequency: 'monthly' as const, priority: 0.5 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl()
  return PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }))
}
