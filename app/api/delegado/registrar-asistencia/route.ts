import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/delegado/registrar-asistencia
 * El asistente delegado registra asistencia de una o varias unidades.
 * Autenticación: token UUID almacenado en asambleas.token_delegado.
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
      !asamblea_id || !token || !Array.isArray(unidad_ids) || unidad_ids.length === 0 ||
      !validUUID.test(asamblea_id.trim()) || !validUUID.test(token.trim()) ||
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

    // Validar token
    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, organization_id, token_delegado')
      .eq('id', asamblea_id.trim())
      .single()

    if (!asamblea) return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    if (!asamblea.token_delegado || asamblea.token_delegado !== token.trim()) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
    }

    // Verificar que las unidades pertenecen a la organización
    const { data: unidades } = await admin
      .from('unidades')
      .select('id, email_propietario, email, nombre_propietario')
      .in('id', unidad_ids)
      .eq('organization_id', asamblea.organization_id)

    const unidadesValidas = unidades || []
    if (unidadesValidas.length === 0) {
      return NextResponse.json({ error: 'Ninguna unidad válida' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const rows = unidadesValidas.map((u: any) => ({
      asamblea_id: asamblea_id.trim(),
      unidad_id: u.id,
      email_propietario: u.email_propietario || u.email || 'asistente.delegado@sistema',
      nombre_propietario: u.nombre_propietario || null,
      presente_fisica: true,
      presente_virtual: false,
      verifico_asistencia: true,
      hora_verificacion: now,
      hora_llegada: now,
      ultima_actividad: now,
    }))

    const { error: upsertErr } = await admin
      .from('quorum_asamblea')
      .upsert(rows, { onConflict: 'asamblea_id,unidad_id', ignoreDuplicates: false })

    if (upsertErr) {
      // Fallback: solo actualizar campos de verificación
      const { error: updateErr } = await admin
        .from('quorum_asamblea')
        .update({ verifico_asistencia: true, hora_verificacion: now })
        .eq('asamblea_id', asamblea_id.trim())
        .in('unidad_id', unidadesValidas.map((u: any) => u.id))
      if (updateErr) {
        console.error('delegado/registrar-asistencia fallback:', updateErr)
        return NextResponse.json({ error: 'Error al guardar asistencia' }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      registradas: unidadesValidas.length,
      ignoradas: unidad_ids.length - unidadesValidas.length,
    })
  } catch (e) {
    console.error('delegado/registrar-asistencia:', e)
    return NextResponse.json({ error: 'Error al registrar asistencia' }, { status: 500 })
  }
}
