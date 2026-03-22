import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function usuarioTieneAccesoConjunto(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (profile) return true
  const { data: byId } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  return !!byId
}

/**
 * POST /api/dashboard/eliminar-sesion-quorum-historial
 * Body: { asamblea_id: string, sesion_id: string }
 *
 * Elimina una fila del historial de validaciones de quórum (asamblea en general, pregunta_id null).
 * Solo permite si la asamblea está en estado `activa` (no finalizada).
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
    const { asamblea_id, sesion_id } = body as { asamblea_id?: string; sesion_id?: string }

    if (!asamblea_id || typeof asamblea_id !== 'string' || !sesion_id || typeof sesion_id !== 'string') {
      return NextResponse.json({ error: 'Faltan asamblea_id o sesion_id' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: asambleaRow, error: asambleaErr } = await admin
      .from('asambleas')
      .select('id, organization_id, estado')
      .eq('id', asamblea_id)
      .maybeSingle()

    if (asambleaErr || !asambleaRow?.organization_id) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    if ((asambleaRow as { estado?: string }).estado !== 'activa') {
      return NextResponse.json(
        {
          error:
            'Solo puedes quitar entradas del historial mientras la asamblea está activa. Si ya finalizó, el acta conserva el registro.',
          code: 'ASAMBLEA_NO_ACTIVA',
        },
        { status: 403 }
      )
    }

    const orgId = asambleaRow.organization_id as string
    const ok = await usuarioTieneAccesoConjunto(supabase, session.user.id, orgId)
    if (!ok) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    const { data: deletedRows, error: delErr } = await admin
      .from('verificacion_asamblea_sesiones')
      .delete()
      .eq('id', sesion_id)
      .eq('asamblea_id', asamblea_id)
      .is('pregunta_id', null)
      .select('id')

    if (delErr) {
      console.error('eliminar-sesion-quorum-historial:', delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    const deleted = Array.isArray(deletedRows) ? deletedRows.length : 0
    if (deleted === 0) {
      return NextResponse.json(
        { error: 'No se encontró la sesión o no pertenece a esta asamblea (general).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    console.error('POST /api/dashboard/eliminar-sesion-quorum-historial:', e)
    return NextResponse.json({ error: 'Error al eliminar la entrada del historial' }, { status: 500 })
  }
}
