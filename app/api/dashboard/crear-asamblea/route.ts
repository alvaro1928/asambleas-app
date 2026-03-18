import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/dashboard/crear-asamblea
 * Modelo Billetera de Tokens por Gestor.
 * Crear asamblea (borrador) es gratuito; no se descuentan tokens.
 * Requiere sesión y que el usuario tenga perfil en la organización.
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
    const { organization_id, nombre, descripcion, fecha, participacion_timer_default_minutes } = body as {
      organization_id?: string
      nombre?: string
      descripcion?: string
      fecha?: string
      participacion_timer_default_minutes?: number
    }

    if (!organization_id || !nombre?.trim() || !fecha) {
      return NextResponse.json(
        { error: 'Faltan organization_id, nombre o fecha' },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (!profile) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .eq('organization_id', organization_id)
        .maybeSingle()
      if (!byId) {
        return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
      }
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const fechaHora = fecha.length <= 10 ? `${fecha}T10:00:00` : fecha
    const timerDefaultMinutes = Math.floor(Number(participacion_timer_default_minutes ?? 5))
    if (!Number.isFinite(timerDefaultMinutes) || timerDefaultMinutes < 1 || timerDefaultMinutes > 180) {
      return NextResponse.json({ error: 'participacion_timer_default_minutes debe ser entre 1 y 180' }, { status: 400 })
    }

    const { data: asamblea, error: insertError } = await admin
      .from('asambleas')
      .insert({
        organization_id,
        nombre: nombre.trim(),
        descripcion: (descripcion?.trim() || null) as string | null,
        fecha: fechaHora,
        estado: 'borrador',
        participacion_timer_default_minutes: timerDefaultMinutes,
      })
      .select()
      .single()

    if (insertError) {
      console.error('crear-asamblea insert:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ asamblea })
  } catch (e) {
    console.error('crear-asamblea:', e)
    return NextResponse.json({ error: 'Error al crear la asamblea' }, { status: 500 })
  }
}
