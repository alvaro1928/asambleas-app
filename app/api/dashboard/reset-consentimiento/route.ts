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
 * POST /api/dashboard/reset-consentimiento
 * Body: { asamblea_id: string }
 *
 * Elimina TODOS los registros de consentimiento de tratamiento de datos (LOPD) para esa asamblea,
 * de modo que todo votante deba aceptar de nuevo al entrar.
 * Requiere que en configuracion_poderes del conjunto permitir_reset_consentimiento_general sea true.
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
    const { asamblea_id } = body as { asamblea_id?: string }

    if (!asamblea_id || typeof asamblea_id !== 'string') {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
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
      .select('id, organization_id')
      .eq('id', asamblea_id)
      .maybeSingle()

    if (asambleaErr || !asambleaRow?.organization_id) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asambleaRow.organization_id as string

    const ok = await usuarioTieneAccesoConjunto(supabase, session.user.id, orgId)
    if (!ok) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    const { data: cfg } = await admin
      .from('configuracion_poderes')
      .select('permitir_reset_consentimiento_general')
      .eq('organization_id', orgId)
      .maybeSingle()

    const permitir = (cfg as { permitir_reset_consentimiento_general?: boolean } | null)
      ?.permitir_reset_consentimiento_general
    if (permitir === false) {
      return NextResponse.json(
        {
          error:
            'El reset masivo de consentimiento está desactivado en Configuración → Poderes y plantilla de correo.',
          code: 'RESET_CONSENTIMIENTO_DESACTIVADO',
        },
        { status: 403 }
      )
    }

    const { data: deletedRows, error: delErr } = await admin
      .from('consentimiento_tratamiento_datos')
      .delete()
      .eq('asamblea_id', asamblea_id)
      .select('id')

    if (delErr) {
      console.error('reset-consentimiento delete:', delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    const deleted = Array.isArray(deletedRows) ? deletedRows.length : 0

    return NextResponse.json({
      ok: true,
      deleted,
    })
  } catch (e) {
    console.error('POST /api/dashboard/reset-consentimiento:', e)
    return NextResponse.json({ error: 'Error al resetear consentimiento' }, { status: 500 })
  }
}
