import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ping-quorum
 * Actualiza ultima_actividad del votante en quorum_asamblea (heartbeat).
 * La página de votar lo llama cada ~2 min para que el Registro de Ingresos
 * solo muestre a quienes tengan actividad reciente.
 * Body: { asamblea_id: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, email } = body

    if (!asamblea_id || !email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'Faltan asamblea_id o email' },
        { status: 400 }
      )
    }

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

    const { error } = await supabase.rpc('actualizar_actividad_quorum', {
      p_asamblea_id: asamblea_id,
      p_email_votante: email.trim()
    })

    if (error) {
      console.error('actualizar_actividad_quorum error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('ping-quorum:', e)
    return NextResponse.json({ error: 'Error al actualizar actividad' }, { status: 500 })
  }
}
