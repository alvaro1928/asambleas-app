import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Accion = 'iniciar_verificacion' | 'iniciar_votacion' | 'cerrar_sesion'

async function tieneAccesoAsamblea(
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
 * POST /api/dashboard/asamblea-sesion
 * Body: { asamblea_id: string, accion: 'iniciar_verificacion' | 'iniciar_votacion' | 'cerrar_sesion' }
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
    const { asamblea_id, accion } = body as { asamblea_id?: string; accion?: Accion }

    if (!asamblea_id || !accion) {
      return NextResponse.json({ error: 'Faltan asamblea_id o accion' }, { status: 400 })
    }

    const valid: Accion[] = ['iniciar_verificacion', 'iniciar_votacion', 'cerrar_sesion']
    if (!valid.includes(accion)) {
      return NextResponse.json({ error: 'accion no válida' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: asm, error: asmErr } = await admin
      .from('asambleas')
      .select('id, organization_id, acceso_publico, session_mode, session_seq')
      .eq('id', asamblea_id)
      .maybeSingle()

    if (asmErr || !asm?.organization_id) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const ok = await tieneAccesoAsamblea(supabase, session.user.id, asm.organization_id as string)
    if (!ok) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    if (accion === 'cerrar_sesion') {
      const { error: rpcErr } = await admin.rpc('cerrar_sesion_votacion_publica', {
        p_asamblea_id: asamblea_id,
      })
      if (rpcErr) {
        console.error('cerrar_sesion_votacion_publica:', rpcErr)
        return NextResponse.json({ error: rpcErr.message }, { status: 500 })
      }
      const { data: fresh } = await admin
        .from('asambleas')
        .select('session_mode, session_seq')
        .eq('id', asamblea_id)
        .maybeSingle()
      return NextResponse.json({ ok: true, session_mode: fresh?.session_mode, session_seq: fresh?.session_seq })
    }

    if (!(asm as { acceso_publico?: boolean }).acceso_publico) {
      return NextResponse.json(
        { error: 'Primero activa el acceso público a la votación para gestionar la sesión.' },
        { status: 409 }
      )
    }

    const nextMode = accion === 'iniciar_verificacion' ? 'verification' : 'voting'

    const { error: updErr } = await admin
      .from('asambleas')
      .update({ session_mode: nextMode })
      .eq('id', asamblea_id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    const { data: fresh } = await admin
      .from('asambleas')
      .select('session_mode, session_seq')
      .eq('id', asamblea_id)
      .maybeSingle()

    return NextResponse.json({ ok: true, session_mode: fresh?.session_mode, session_seq: fresh?.session_seq })
  } catch (e) {
    console.error('POST /api/dashboard/asamblea-sesion:', e)
    return NextResponse.json({ error: 'Error al actualizar la sesión' }, { status: 500 })
  }
}
