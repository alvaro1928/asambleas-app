import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/delegado/registrar-voto
 * El asistente delegado vota en nombre de una unidad.
 * Autenticación: token UUID almacenado en asambleas.token_delegado.
 *
 * Body: {
 *   asamblea_id: string,
 *   token: string,
 *   unidad_id: string,
 *   votante_email: string,
 *   votante_nombre: string,
 *   votos: Array<{ pregunta_id: string; opcion_id: string }>
 * }
 *
 * Reutiliza la RPC `registrar_voto_con_trazabilidad` igual que el admin,
 * pero marca el votante con "(registrado por asistente delegado)".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, token, unidad_id, votante_email, votante_nombre, votos } = body as {
      asamblea_id?: string
      token?: string
      unidad_id?: string
      votante_email?: string
      votante_nombre?: string
      votos?: Array<{ pregunta_id: string; opcion_id: string }>
    }

    const validUUID = /^[0-9a-f-]{36}$/i
    if (
      !asamblea_id || !token || !unidad_id || !votante_email ||
      !Array.isArray(votos) || votos.length === 0 ||
      !validUUID.test(asamblea_id.trim()) ||
      !validUUID.test(token.trim()) ||
      !validUUID.test(unidad_id.trim())
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

    // Verificar que la unidad pertenece a la organización
    const { data: unidad } = await admin
      .from('unidades')
      .select('id, organization_id')
      .eq('id', unidad_id.trim())
      .eq('organization_id', asamblea.organization_id)
      .single()

    if (!unidad) return NextResponse.json({ error: 'Unidad no válida para esta asamblea' }, { status: 400 })

    // Verificar que las preguntas pertenecen a la asamblea y están abiertas
    const { data: preguntas } = await admin
      .from('preguntas')
      .select('id, estado')
      .eq('asamblea_id', asamblea_id.trim())

    const abiertas = new Set((preguntas || []).filter((p: any) => p.estado === 'abierta').map((p: any) => p.id))
    const idsAsamblea = new Set((preguntas || []).map((p: any) => p.id))

    for (const v of votos) {
      if (!v.pregunta_id || !v.opcion_id || !validUUID.test(v.pregunta_id) || !validUUID.test(v.opcion_id)) {
        return NextResponse.json({ error: 'Voto con datos inválidos' }, { status: 400 })
      }
      if (!idsAsamblea.has(v.pregunta_id)) {
        return NextResponse.json({ error: 'Pregunta no pertenece a esta asamblea' }, { status: 400 })
      }
      if (!abiertas.has(v.pregunta_id)) {
        return NextResponse.json({ error: 'La pregunta no está abierta para votación' }, { status: 400 })
      }
    }

    const email = String(votante_email).toLowerCase().trim()
    const nombre = (votante_nombre || 'Residente').trim()
    const nombreAudit = `${nombre} (registrado por asistente delegado)`
    const userAgentAudit = '[Registrado por asistente delegado]'
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      null

    const results: Array<{ pregunta_id: string; success: boolean; error?: string }> = []

    for (const v of votos) {
      const { error } = await admin.rpc('registrar_voto_con_trazabilidad', {
        p_pregunta_id: v.pregunta_id,
        p_unidad_id: unidad_id.trim(),
        p_opcion_id: v.opcion_id,
        p_votante_email: email,
        p_votante_nombre: nombreAudit,
        p_es_poder: false,
        p_poder_id: null,
        p_ip_address: ip,
        p_user_agent: userAgentAudit,
      })

      results.push({ pregunta_id: v.pregunta_id, success: !error, error: error?.message })
    }

    const allOk = results.every((r) => r.success)
    return NextResponse.json(
      { success: allOk, results, message: allOk ? 'Votos registrados correctamente' : 'Algunos votos no se registraron' },
      { status: allOk ? 200 : 207 }
    )
  } catch (e) {
    console.error('delegado/registrar-voto:', e)
    return NextResponse.json({ error: 'Error al registrar voto' }, { status: 500 })
  }
}
