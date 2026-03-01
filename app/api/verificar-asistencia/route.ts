import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/verificar-asistencia
 * El votante confirma su asistencia cuando el administrador activa
 * la verificación de quórum. Actualiza quorum_asamblea.verifico_asistencia = true.
 * Body: { asamblea_id: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, email } = body as { asamblea_id?: string; email?: string }

    if (!asamblea_id || !email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'Faltan asamblea_id o email' },
        { status: 400 }
      )
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuración interna incompleta' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Verificar que la asamblea tenga la verificación activa
    const { data: asamblea, error: fetchErr } = await admin
      .from('asambleas')
      .select('id, verificacion_asistencia_activa')
      .eq('id', asamblea_id)
      .single()

    if (fetchErr || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    if (!asamblea.verificacion_asistencia_activa) {
      return NextResponse.json(
        { error: 'La verificación de asistencia no está activa en este momento' },
        { status: 409 }
      )
    }

    // Marcar verifico_asistencia = true para el registro de esta unidad
    const { error: updateErr } = await admin
      .from('quorum_asamblea')
      .update({
        verifico_asistencia: true,
        hora_verificacion: new Date().toISOString(),
      })
      .eq('asamblea_id', asamblea_id)
      .eq('email_propietario', email.trim().toLowerCase())

    if (updateErr) {
      console.error('verificar-asistencia update:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('verificar-asistencia:', e)
    return NextResponse.json({ error: 'Error al registrar verificación' }, { status: 500 })
  }
}
