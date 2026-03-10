import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/delegado/quitar-asistencia
 * El asistente delegado quita la asistencia verificada de una o varias unidades
 * en la sesión actual. Solo mientras la verificación está activa.
 * Autenticación: token en asambleas.token_delegado.
 * Body: { asamblea_id, token, unidad_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, token, unidad_ids } = body as {
      asamblea_id?: string
      token?: string
      unidad_ids?: string[]
    }

    const validUUID = /^[0-9a-f-]{36}$/i
    if (
      !asamblea_id ||
      !token ||
      !Array.isArray(unidad_ids) ||
      unidad_ids.length === 0 ||
      !validUUID.test(asamblea_id.trim()) ||
      !validUUID.test(token.trim()) ||
      unidad_ids.length > 500 ||
      unidad_ids.some((id) => typeof id !== 'string' || !validUUID.test(id))
    ) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return NextResponse.json({ error: 'Config interna incompleta' }, { status: 500 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, organization_id, token_delegado, verificacion_pregunta_id')
      .eq('id', asamblea_id.trim())
      .single()

    if (!asamblea) return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    if (!asamblea.token_delegado || asamblea.token_delegado !== token.trim()) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
    }

    const preguntaId = (asamblea as { verificacion_pregunta_id?: string | null }).verificacion_pregunta_id ?? null

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
        {
          error:
            'Solo se puede quitar asistencia mientras la verificación está activa. Activa la verificación de quórum e intenta de nuevo.',
        },
        { status: 400 }
      )
    }

    const { data: quorumRows } = await admin
      .from('quorum_asamblea')
      .select('id')
      .eq('asamblea_id', asamblea_id.trim())
      .in('unidad_id', unidad_ids)

    const quorumIds = (quorumRows || []).map((r: { id: string }) => r.id)
    if (quorumIds.length === 0) {
      return NextResponse.json({ ok: true, quitadas: 0 })
    }

    let query = admin
      .from('verificacion_asistencia_registro')
      .delete()
      .eq('asamblea_id', asamblea_id.trim())
      .in('quorum_asamblea_id', quorumIds)
      .gte('creado_en', aperturaAt)
    if (preguntaId == null) {
      query = query.is('pregunta_id', null)
    } else {
      query = query.eq('pregunta_id', preguntaId)
    }
    const { error: deleteErr } = await query

    if (deleteErr) {
      console.error('delegado/quitar-asistencia delete:', deleteErr)
      return NextResponse.json({ error: 'Error al quitar asistencia' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, quitadas: quorumIds.length })
  } catch (e) {
    console.error('delegado/quitar-asistencia:', e)
    return NextResponse.json({ error: 'Error al quitar asistencia' }, { status: 500 })
  }
}
