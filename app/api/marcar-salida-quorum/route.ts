import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/marcar-salida-quorum
 * Marca como "salida" al votante en el quórum (presente_virtual = false)
 * para que el Registro de Ingresos en Tiempo Real solo muestre sesiones activas.
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

    const { error } = await supabase.rpc('marcar_salida_quorum', {
      p_asamblea_id: asamblea_id,
      p_email_votante: email.trim()
    })

    if (error) {
      console.error('marcar_salida_quorum error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('marcar-salida-quorum:', e)
    return NextResponse.json({ error: 'Error al marcar salida' }, { status: 500 })
  }
}
