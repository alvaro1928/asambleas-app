import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/dashboard/eliminar-conjunto
 * Elimina un conjunto (organización) del usuario solo si no tiene asambleas activas ni finalizadas.
 * Requiere sesión y que el usuario pertenezca al conjunto. Misma lógica de borrado que super-admin.
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
    const { id } = body as { id?: string }
    if (!id) {
      return NextResponse.json({ error: 'Falta id del conjunto' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .eq('organization_id', id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Error de configuración del servidor' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: org, error: fetchOrg } = await admin
      .from('organizations')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchOrg || !org) {
      return NextResponse.json({ error: 'Conjunto no encontrado' }, { status: 404 })
    }

    const orgId = org.id as string

    const { data: asambleasActivasFinalizadas } = await admin
      .from('asambleas')
      .select('id')
      .eq('organization_id', orgId)
      .in('estado', ['activa', 'finalizada'])
    if (asambleasActivasFinalizadas && asambleasActivasFinalizadas.length > 0) {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar el conjunto porque tiene asambleas activas o finalizadas. Solo se pueden eliminar conjuntos sin asambleas o cuyas asambleas estén todas en borrador.',
        },
        { status: 400 }
      )
    }

    const { data: asambleas } = await admin.from('asambleas').select('id').eq('organization_id', orgId)
    const asambleaIds = (asambleas || []).map((a) => (a as { id: string }).id)

    if (asambleaIds.length > 0) {
      const { data: preguntas } = await admin.from('preguntas').select('id').in('asamblea_id', asambleaIds)
      const preguntaIds = (preguntas || []).map((p) => (p as { id: string }).id)
      if (preguntaIds.length > 0) {
        const { data: votos } = await admin.from('votos').select('id').in('pregunta_id', preguntaIds)
        const votoIds = (votos || []).map((v) => (v as { id: string }).id)
        if (votoIds.length > 0) {
          await admin.from('historial_votos').delete().in('voto_id', votoIds)
        }
        await admin.from('votos').delete().in('pregunta_id', preguntaIds)
        await admin.from('opciones_pregunta').delete().in('pregunta_id', preguntaIds)
      }
      await admin.from('preguntas').delete().in('asamblea_id', asambleaIds)
      await admin.from('quorum_asamblea').delete().in('asamblea_id', asambleaIds)
      await admin.from('poderes').delete().in('asamblea_id', asambleaIds)
    }
    await admin.from('asambleas').delete().eq('organization_id', orgId)

    const { data: unidades } = await admin.from('unidades').select('id').eq('organization_id', orgId)
    const unidadIds = (unidades || []).map((u) => (u as { id: string }).id)
    if (unidadIds.length > 0) {
      await admin.from('poderes').delete().in('unidad_id', unidadIds)
    }
    await admin.from('unidades').delete().eq('organization_id', orgId)

    await admin.from('profiles').update({ organization_id: null }).eq('organization_id', orgId)
    await admin.from('pagos_log').delete().eq('organization_id', orgId)
    await admin.from('configuracion_poderes').delete().eq('organization_id', orgId)

    const { error: deleteOrgErr } = await admin.from('organizations').delete().eq('id', orgId)

    if (deleteOrgErr) {
      console.error('dashboard eliminar-conjunto:', deleteOrgErr)
      return NextResponse.json({ error: deleteOrgErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('dashboard eliminar-conjunto:', e)
    return NextResponse.json({ error: 'Error al eliminar el conjunto' }, { status: 500 })
  }
}
