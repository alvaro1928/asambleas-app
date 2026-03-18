import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/dashboard/participacion-timer/set-enabled
 * Habilita o deshabilita el cronómetro transversal de participación.
 * Body: { asamblea_id: string, enabled: boolean }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}))
    const asambleaId = typeof body?.asamblea_id === 'string' ? body.asamblea_id.trim() : ''
    const enabled = typeof body?.enabled === 'boolean' ? body.enabled : null

    if (!asambleaId || enabled === null) {
      return NextResponse.json({ error: 'Faltan asamblea_id o enabled (boolean)' }, { status: 400 })
    }

    // Validar ownership por organización
    const { data: asamblea, error: errAsamblea } = await supabase
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', asambleaId)
      .single()

    if (errAsamblea || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = (asamblea as { organization_id?: string }).organization_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Sin permiso para esta asamblea' }, { status: 403 })
    }

    const updatePayload: Record<string, any> = {
      participacion_timer_enabled: enabled,
    }
    if (!enabled) {
      updatePayload.participacion_timer_end_at = null
    }

    const { error: updateError } = await supabase
      .from('asambleas')
      .update(updatePayload)
      .eq('id', asambleaId)

    if (updateError) {
      return NextResponse.json({ error: 'Error al actualizar cronómetro' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, participacion_timer_enabled: enabled })
  } catch (e) {
    console.error('participacion-timer/set-enabled (admin):', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

