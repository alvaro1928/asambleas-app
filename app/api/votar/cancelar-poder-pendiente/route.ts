import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { identificadorCoincide } from '@/lib/votar-identificador'

/**
 * POST /api/votar/cancelar-poder-pendiente
 * El votante anula su propia solicitud en pendiente_verificacion (equivale a retirar el trámite).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo, identificador, poder_id } = body as {
      codigo?: string
      identificador?: string
      poder_id?: string
    }

    if (!codigo?.trim() || !identificador?.trim() || !poder_id?.trim()) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: codigoData, error: codigoError } = await admin.rpc('validar_codigo_acceso', {
      p_codigo: codigo.trim(),
    })
    if (codigoError || !codigoData || codigoData.length === 0 || !codigoData[0].acceso_valido) {
      return NextResponse.json({ error: 'Código de acceso inválido o cerrado' }, { status: 403 })
    }

    const asambleaId = codigoData[0].asamblea_id as string
    const ident = identificador.trim()

    const { data: poder, error: fetchErr } = await admin
      .from('poderes')
      .select('id, asamblea_id, estado, email_receptor, observaciones')
      .eq('id', poder_id.trim())
      .maybeSingle()

    if (fetchErr || !poder) {
      return NextResponse.json({ error: 'No se encontró la solicitud' }, { status: 404 })
    }

    if (poder.asamblea_id !== asambleaId) {
      return NextResponse.json({ error: 'La solicitud no corresponde a esta asamblea' }, { status: 403 })
    }

    if (poder.estado !== 'pendiente_verificacion') {
      return NextResponse.json(
        { error: 'Solo puedes cancelar solicitudes que siguen pendientes de verificación.' },
        { status: 400 }
      )
    }

    if (!identificadorCoincide(poder.email_receptor, ident)) {
      return NextResponse.json({ error: 'No tienes permiso para cancelar esta solicitud' }, { status: 403 })
    }

    const nota = '[Cancelado por el solicitante desde la votación] '
    const obsPrev = String(poder.observaciones ?? '').trim()
    const observaciones = obsPrev ? `${nota}${obsPrev}` : nota.trim()

    const { data: updated, error: updErr } = await admin
      .from('poderes')
      .update({
        estado: 'revocado',
        revocado_at: new Date().toISOString(),
        observaciones,
      })
      .eq('id', poder.id)
      .eq('estado', 'pendiente_verificacion')
      .select('id')

    if (updErr) {
      console.error('[cancelar-poder-pendiente]', updErr)
      return NextResponse.json({ error: 'No se pudo cancelar la solicitud' }, { status: 500 })
    }
    if (!updated?.length) {
      return NextResponse.json(
        { error: 'La solicitud ya no está pendiente; quizá fue procesada o cancelada.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true, mensaje: 'Solicitud cancelada.' })
  } catch (e) {
    console.error('[api/votar/cancelar-poder-pendiente]', e)
    return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })
  }
}
