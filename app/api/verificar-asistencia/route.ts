import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/verificar-asistencia
 * El votante confirma su asistencia cuando el administrador activa
 * la verificación de quórum. Actualiza quorum_asamblea.verifico_asistencia = true.
 * Body: { asamblea_id: string, email: string }
 *
 * Sin sesión requerida (votantes acceden via código público), pero:
 *  - El asamblea_id debe ser UUID válido y la verificación debe estar activa.
 *  - El email debe existir ya en quorum_asamblea para esa asamblea (creado al validar el votante).
 *  - Si el email no está registrado la operación afecta 0 filas → 404 al cliente.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, email } = body as { asamblea_id?: string; email?: string }

    // Validación básica de inputs
    if (
      !asamblea_id ||
      !email ||
      typeof asamblea_id !== 'string' ||
      typeof email !== 'string' ||
      !email.trim() ||
      // Validación básica de formato UUID (evita inyecciones a nivel de query)
      !/^[0-9a-f-]{36}$/i.test(asamblea_id.trim())
    ) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const emailNorm = email.trim().toLowerCase()

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración interna incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Verificar que la asamblea existe y tiene la verificación activa
    const { data: asamblea, error: fetchErr } = await admin
      .from('asambleas')
      .select('id, verificacion_asistencia_activa')
      .eq('id', asamblea_id.trim())
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

    const now = new Date().toISOString()

    // Obtener las filas del votante en quorum_asamblea (puede ser >1 si tiene varios poderes/unidades)
    const { data: filas, error: fetchFilasErr } = await admin
      .from('quorum_asamblea')
      .select('id, verifico_asistencia')
      .eq('asamblea_id', asamblea_id.trim())
      // Comparación case-insensitive via ilike o LOWER — usamos filter con ilike
      .ilike('email_propietario', emailNorm)

    if (fetchFilasErr) {
      console.error('verificar-asistencia fetch filas:', fetchFilasErr)
      return NextResponse.json({ error: 'Error al buscar registro' }, { status: 500 })
    }

    if (!filas || filas.length === 0) {
      // El votante no está en quorum_asamblea — no debería ocurrir porque se crea al validar,
      // pero puede pasar si la verificación fue activada antes del login
      return NextResponse.json(
        { error: 'No se encontró tu registro en esta asamblea. Intenta salir y volver a entrar.' },
        { status: 404 }
      )
    }

    // Marcar todas las filas del votante como verificadas
    const ids = filas.map((f: any) => f.id)
    const { error: updateErr } = await admin
      .from('quorum_asamblea')
      .update({ verifico_asistencia: true, hora_verificacion: now })
      .in('id', ids)

    if (updateErr) {
      console.error('verificar-asistencia update:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, filas_actualizadas: ids.length })
  } catch (e) {
    console.error('verificar-asistencia:', e)
    return NextResponse.json({ error: 'Error al registrar verificación' }, { status: 500 })
  }
}
