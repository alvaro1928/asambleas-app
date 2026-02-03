import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/dashboard/eliminar-asamblea
 * Elimina una asamblea solo si no está activa (borrador o finalizada).
 * Requiere sesión y que el usuario pertenezca al conjunto de la asamblea.
 * La BD elimina en cascada: preguntas, opciones, votos, historial, poderes, quorum.
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { asamblea_id } = body as { asamblea_id?: string }
    if (!asamblea_id) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
    }

    const { data: asamblea, error: fetchError } = await supabase
      .from('asambleas')
      .select('id, nombre, estado, organization_id')
      .eq('id', asamblea_id)
      .single()

    if (fetchError || !asamblea) {
      return NextResponse.json(
        { error: 'Asamblea no encontrada' },
        { status: 404 }
      )
    }

    if (asamblea.estado === 'activa') {
      return NextResponse.json(
        { error: 'No se puede eliminar una asamblea activa. Finalízala antes.' },
        { status: 400 }
      )
    }

    const orgId = asamblea.organization_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!profile) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!byId) {
        return NextResponse.json(
          { error: 'No tienes acceso a esta asamblea' },
          { status: 403 }
        )
      }
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { error: deleteError } = await admin
      .from('asambleas')
      .delete()
      .eq('id', asamblea_id)

    if (deleteError) {
      console.error('eliminar-asamblea:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('eliminar-asamblea:', e)
    return NextResponse.json(
      { error: 'Error al eliminar la asamblea' },
      { status: 500 }
    )
  }
}
