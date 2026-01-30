import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/votar
 * Registra un voto con trazabilidad (para stress test k6 y uso desde cliente si se desea).
 * Body: { pregunta_id, opcion_id, unidad_id, votante_email, votante_nombre?, es_poder?, poder_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      pregunta_id,
      opcion_id,
      unidad_id,
      votante_email,
      votante_nombre = 'Votante stress test',
      es_poder = false,
      poder_id = null,
    } = body

    if (!pregunta_id || !opcion_id || !unidad_id || !votante_email) {
      return NextResponse.json(
        { error: 'Faltan pregunta_id, opcion_id, unidad_id o votante_email' },
        { status: 400 }
      )
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || null

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

    const { data, error } = await supabase.rpc('registrar_voto_con_trazabilidad', {
      p_pregunta_id: pregunta_id,
      p_unidad_id: unidad_id,
      p_opcion_id: opcion_id,
      p_votante_email: String(votante_email).toLowerCase().trim(),
      p_votante_nombre: votante_nombre || 'Votante',
      p_es_poder: !!es_poder,
      p_poder_id: poder_id || null,
      p_ip_address: ip,
      p_user_agent: userAgent,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: data?.[0] ?? data })
  } catch (e) {
    console.error('[api/votar]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar voto' },
      { status: 500 }
    )
  }
}
