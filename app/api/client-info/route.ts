import { NextRequest, NextResponse } from 'next/server'
import { logRouteError, publicErrorMessage } from '@/lib/route-errors'

export const dynamic = 'force-dynamic'

/**
 * Devuelve IP y user-agent del cliente para trazabilidad de votos.
 * La IP se toma de cabeceras de proxy (Vercel, etc.); el cliente envía user-agent.
 */
export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIp || null
    const userAgent = request.headers.get('user-agent') || null
    return NextResponse.json({ ip, userAgent })
  } catch (e) {
    logRouteError('api/client-info', e)
    return NextResponse.json(
      {
        error: publicErrorMessage(e, 'No se pudo leer la información del cliente'),
        ip: null,
        userAgent: null,
      },
      { status: 500 }
    )
  }
}
