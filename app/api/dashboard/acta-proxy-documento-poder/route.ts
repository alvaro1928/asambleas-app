import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/dashboard/acta-proxy-documento-poder?url=...
 * Proxy para descargar documentos de poder desde Supabase Storage.
 * Evita CORS en el cliente al generar el ZIP con anexos en la descarga del acta.
 * Solo acepta URLs del bucket poderes-docs del mismo proyecto Supabase.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const url = request.nextUrl.searchParams.get('url')
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Falta parámetro url' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!baseUrl) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    // Solo permitir URLs del storage público del mismo proyecto (bucket poderes-docs)
    const storagePath = `${baseUrl}/storage/v1/object/public/poderes-docs/`
    if (!url.startsWith(storagePath)) {
      return NextResponse.json({ error: 'URL no permitida' }, { status: 400 })
    }

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'No se pudo obtener el documento' },
        { status: res.status === 404 ? 404 : 502 }
      )
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const blob = await res.arrayBuffer()

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (e) {
    console.error('acta-proxy-documento-poder:', e)
    return NextResponse.json({ error: 'Error al obtener el documento' }, { status: 500 })
  }
}
