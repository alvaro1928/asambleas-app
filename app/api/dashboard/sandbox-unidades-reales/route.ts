import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PATCH /api/dashboard/sandbox-unidades-reales
 * Solo para asambleas demo (is_demo=true). Alterna si la sandbox usa unidades de demostración o unidades reales del conjunto.
 * Body: { asamblea_id: string, sandbox_usar_unidades_reales: boolean }
 */
export async function PATCH(request: NextRequest) {
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
    const asambleaId = typeof body?.asamblea_id === 'string' ? body.asamblea_id.trim() : null
    const usarReales = typeof body?.sandbox_usar_unidades_reales === 'boolean' ? body.sandbox_usar_unidades_reales : null

    if (!asambleaId || usarReales === null) {
      return NextResponse.json(
        { error: 'Faltan asamblea_id o sandbox_usar_unidades_reales (boolean)' },
        { status: 400 }
      )
    }

    const { data: asamblea, error: errAsamblea } = await supabase
      .from('asambleas')
      .select('id, organization_id, is_demo')
      .eq('id', asambleaId)
      .single()

    if (errAsamblea || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    if ((asamblea as { is_demo?: boolean }).is_demo !== true) {
      return NextResponse.json(
        { error: 'Solo se puede cambiar en asambleas de demostración (sandbox)' },
        { status: 400 }
      )
    }

    const orgId = (asamblea as { organization_id?: string }).organization_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta asamblea' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('asambleas')
      .update({ sandbox_usar_unidades_reales: usarReales })
      .eq('id', asambleaId)

    if (updateError) {
      console.error('sandbox-unidades-reales update:', updateError)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sandbox_usar_unidades_reales: usarReales })
  } catch (e) {
    console.error('sandbox-unidades-reales:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
