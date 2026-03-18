import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/dashboard/participacion-timer/set-default
 * Configura el valor por defecto (minutos) para la asamblea.
 * Body: { asamblea_id: string, minutes: number }
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
    const minutesRaw = body?.minutes
    const minutes = Number.isFinite(minutesRaw) ? Number(minutesRaw) : typeof minutesRaw === 'number' ? minutesRaw : null

    if (!asambleaId || minutes === null) {
      return NextResponse.json({ error: 'Faltan asamblea_id o minutes (número)' }, { status: 400 })
    }

    const MIN_MINUTES = 1
    const MAX_MINUTES = 180
    if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      return NextResponse.json({ error: `minutes debe ser entero entre ${MIN_MINUTES} y ${MAX_MINUTES}` }, { status: 400 })
    }

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

    const { error: updateError } = await supabase
      .from('asambleas')
      .update({
        participacion_timer_default_minutes: minutes,
      })
      .eq('id', asambleaId)

    if (updateError) {
      return NextResponse.json({ error: 'Error al actualizar default' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, participacion_timer_default_minutes: minutes })
  } catch (e) {
    console.error('participacion-timer/set-default (admin):', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

