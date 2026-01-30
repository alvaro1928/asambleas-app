import { NextRequest, NextResponse } from 'next/server'

/**
 * Devuelve IP y user-agent del cliente para trazabilidad de votos.
 * La IP se toma de cabeceras de proxy (Vercel, etc.); el cliente envía user-agent.
 */
export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0]?.trim() || realIp || null
  const userAgent = request.headers.get('user-agent') || null
  return NextResponse.json({ ip, userAgent })
}
