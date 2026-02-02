import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/stress-test/reset
 * Limpia los votos de una asamblea de prueba (solo en desarrollo o con secret).
 * Body: { asamblea_id: string, secret?: string }
 * Opcional: devuelve tokens al gestor si se usaron en esta asamblea (billing_logs).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRESS_TEST_SECRET
  const isDev = process.env.NODE_ENV === 'development'
  if (!secret && !isDev) {
    return NextResponse.json({ error: 'No autorizado (solo desarrollo o STRESS_TEST_SECRET)' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, secret: bodySecret } = body as { asamblea_id?: string; secret?: string }

    if (bodySecret && bodySecret !== secret) {
      return NextResponse.json({ error: 'Secret inválido' }, { status: 403 })
    }
    if (!asamblea_id || typeof asamblea_id !== 'string') {
      return NextResponse.json({ error: 'asamblea_id es requerido' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: preguntas } = await admin
      .from('preguntas')
      .select('id')
      .eq('asamblea_id', asamblea_id)
    const preguntaIds = (preguntas ?? []).map((p) => p.id)
    if (preguntaIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Asamblea sin preguntas o no encontrada',
        votos_eliminados: 0,
        historial_eliminado: 0,
      })
    }

    const { data: votosRows } = await admin.from('votos').select('id').in('pregunta_id', preguntaIds)
    const votoIds = (votosRows ?? []).map((v) => v.id)

    let historialDeleted = 0
    if (votoIds.length > 0) {
      const { count } = await admin.from('historial_votos').delete().in('voto_id', votoIds).select('*', { count: 'exact', head: true })
      historialDeleted = count ?? 0
    }

    const { count: votosDeleted } = await admin.from('votos').delete().in('pregunta_id', preguntaIds).select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      message: 'Votos de la asamblea de prueba eliminados. Los tokens del gestor no se devuelven automáticamente (se consumen al activar votación/acta).',
      votos_eliminados: votosDeleted ?? 0,
      historial_eliminado: historialDeleted,
    })
  } catch (e) {
    console.error('[api/stress-test/reset]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al resetear votos' },
      { status: 500 }
    )
  }
}
