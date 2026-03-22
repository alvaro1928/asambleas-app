import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/quitar-asistencia-manual
 * Quita la asistencia verificada de una o varias unidades en la sesión actual.
 * Solo aplica a registros de la sesión actual (creado_en >= apertura_at de la sesión abierta).
 * Body: { asamblea_id: string, unidad_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
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
    const { asamblea_id, unidad_ids } = body as { asamblea_id?: string; unidad_ids?: string[] }

    if (
      !asamblea_id ||
      typeof asamblea_id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(asamblea_id.trim()) ||
      !Array.isArray(unidad_ids) ||
      unidad_ids.length === 0 ||
      unidad_ids.length > 500
    ) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const validUUIDs = /^[0-9a-f-]{36}$/i
    if (unidad_ids.some((id) => typeof id !== 'string' || !validUUIDs.test(id))) {
      return NextResponse.json({ error: 'unidad_ids contiene valores inválidos' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración interna incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', asamblea_id.trim())
      .single()

    if (!asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    if (profile?.organization_id && asamblea.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Sin permiso para esta asamblea' }, { status: 403 })
    }

    // Sesión abierta (verificación activa): solo quitamos registros de esta sesión
    const { data: sesionAbierta } = await admin
      .from('verificacion_asamblea_sesiones')
      .select('apertura_at')
      .eq('asamblea_id', asamblea_id.trim())
      .is('cierre_at', null)
      .limit(1)
      .single()

    const aperturaAt = (sesionAbierta as { apertura_at?: string } | null)?.apertura_at ?? null
    if (!aperturaAt) {
      return NextResponse.json(
        { error: 'Solo se puede quitar asistencia mientras la verificación está activa. Activa la verificación de quórum e intenta de nuevo.' },
        { status: 400 }
      )
    }

    // IDs de quorum_asamblea para las unidades indicadas
    const { data: quorumRows } = await admin
      .from('quorum_asamblea')
      .select('id')
      .eq('asamblea_id', asamblea_id.trim())
      .in('unidad_id', unidad_ids)

    const quorumIds = (quorumRows || []).map((r: { id: string }) => r.id)
    if (quorumIds.length === 0) {
      return NextResponse.json({ ok: true, quitadas: 0 })
    }

    const { error: deleteErr } = await admin
      .from('verificacion_asistencia_registro')
      .delete()
      .eq('asamblea_id', asamblea_id.trim())
      .in('quorum_asamblea_id', quorumIds)
      .gte('creado_en', aperturaAt)

    if (deleteErr) {
      console.error('quitar-asistencia-manual delete:', deleteErr)
      return NextResponse.json({ error: 'Error al quitar asistencia' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      quitadas: quorumIds.length,
    })
  } catch (e) {
    console.error('quitar-asistencia-manual:', e)
    return NextResponse.json({ error: 'Error al quitar asistencia' }, { status: 500 })
  }
}
