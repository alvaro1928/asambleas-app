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
 * POST /api/dashboard/eliminar-opcion-pregunta
 * Body: { pregunta_id: string, opcion_id: string }
 *
 * Elimina una opción de una pregunta abierta o cerrada. Los votos asociados se eliminan en cascada (FK).
 * Deben quedar al menos 2 opciones en la pregunta.
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
    const { pregunta_id, opcion_id } = body as { pregunta_id?: string; opcion_id?: string }

    if (!pregunta_id || typeof pregunta_id !== 'string' || !opcion_id || typeof opcion_id !== 'string') {
      return NextResponse.json({ error: 'Faltan pregunta_id u opcion_id' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: preguntaRow, error: preguntaErr } = await admin
      .from('preguntas')
      .select('id, asamblea_id, estado')
      .eq('id', pregunta_id)
      .maybeSingle()

    if (preguntaErr || !preguntaRow) {
      return NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })
    }

    const estadoP = (preguntaRow as { estado?: string }).estado
    if (estadoP !== 'abierta' && estadoP !== 'cerrada') {
      return NextResponse.json(
        {
          error: 'Solo se pueden eliminar opciones de preguntas abiertas o cerradas. En pendiente, edita y guarda desde el formulario.',
          code: 'PREGUNTA_ESTADO',
        },
        { status: 403 }
      )
    }

    const { data: asambleaRow, error: asambleaErr } = await admin
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', (preguntaRow as { asamblea_id: string }).asamblea_id)
      .maybeSingle()

    if (asambleaErr || !asambleaRow?.organization_id) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asambleaRow.organization_id as string
    const ok = await usuarioTieneAccesoConjunto(supabase, session.user.id, orgId)
    if (!ok) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    const { data: opcionRow, error: opcionErr } = await admin
      .from('opciones_pregunta')
      .select('id')
      .eq('id', opcion_id)
      .eq('pregunta_id', pregunta_id)
      .maybeSingle()

    if (opcionErr || !opcionRow) {
      return NextResponse.json({ error: 'Opción no encontrada en esta pregunta' }, { status: 404 })
    }

    const { count, error: countErr } = await admin
      .from('opciones_pregunta')
      .select('id', { count: 'exact', head: true })
      .eq('pregunta_id', pregunta_id)

    if (countErr) {
      console.error('eliminar-opcion-pregunta count:', countErr)
      return NextResponse.json({ error: 'No se pudo validar las opciones' }, { status: 500 })
    }

    if ((count ?? 0) <= 2) {
      return NextResponse.json(
        { error: 'Debe quedar al menos 2 opciones de respuesta. Añade otra opción antes de eliminar esta.' },
        { status: 400 }
      )
    }

    const { error: delErr } = await admin.from('opciones_pregunta').delete().eq('id', opcion_id).eq('pregunta_id', pregunta_id)

    if (delErr) {
      console.error('eliminar-opcion-pregunta delete:', delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/dashboard/eliminar-opcion-pregunta:', e)
    return NextResponse.json({ error: 'Error al eliminar la opción' }, { status: 500 })
  }
}
