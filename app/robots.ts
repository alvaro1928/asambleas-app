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
const baseUrl = getBaseUrl()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/', '/auth/', '/super-admin/', '/votar/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
