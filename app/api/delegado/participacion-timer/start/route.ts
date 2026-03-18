import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/delegado/participacion-timer/start
 * Inicia/reinicia el cronómetro de participación (solo indicador).
 * Autenticación: token_delegado en asambleas.token_delegado.
 * Body: { asamblea_id: string, token: string, minutes: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, token, minutes } = body as {
      asamblea_id?: string
      token?: string
      minutes?: number
    }

    const asambleaId = typeof asamblea_id === 'string' ? asamblea_id.trim() : ''
    const tokenStr = typeof token === 'string' ? token.trim() : ''
    const minutesNum = typeof minutes === 'number' ? minutes : Number(minutes)

    const validUUID = /^[0-9a-f-]{36}$/i
    if (!asambleaId || !tokenStr || !validUUID.test(asambleaId) || !validUUID.test(tokenStr) || !Number.isFinite(minutesNum)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const MIN_MINUTES = 1
    const MAX_MINUTES = 180
    if (!Number.isInteger(minutesNum) || minutesNum < MIN_MINUTES || minutesNum > MAX_MINUTES) {
      return NextResponse.json({ error: `minutes debe ser entero entre ${MIN_MINUTES} y ${MAX_MINUTES}` }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return NextResponse.json({ error: 'Config interna incompleta' }, { status: 500 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } })

    // Validar token
    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, token_delegado')
      .eq('id', asambleaId)
      .single()

    if (!asamblea) return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    if (!asamblea.token_delegado || asamblea.token_delegado !== tokenStr) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

    const endAt = new Date(Date.now() + minutesNum * 60 * 1000).toISOString()

    const { error: updateError } = await admin
      .from('asambleas')
      .update({ participacion_timer_end_at: endAt })
      .eq('id', asambleaId)

    if (updateError) return NextResponse.json({ error: 'Error al iniciar cronómetro' }, { status: 500 })

    return NextResponse.json({ ok: true, participacion_timer_end_at: endAt })
  } catch (e) {
    console.error('participacion-timer/start (delegado):', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

