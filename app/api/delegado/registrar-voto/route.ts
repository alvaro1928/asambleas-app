import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/delegado/registrar-voto
 * El asistente delegado vota en nombre de una o varias unidades.
 * Autenticación: token UUID almacenado en asambleas.token_delegado.
 *
 * Body: {
 *   asamblea_id: string,
 *   token: string,
 *   unidad_id?: string,
 *   unidad_ids?: string[],
 *   votante_email?: string,
 *   votante_nombre?: string,
 *   votos: Array<{ pregunta_id: string; opcion_id: string }>
 * }
 *
 * Reutiliza la RPC `registrar_voto_con_trazabilidad` igual que el admin,
 * pero marca el votante con "(registrado por asistente delegado)".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { asamblea_id, token, unidad_id, unidad_ids, votante_email, votante_nombre, votos } = body as {
      asamblea_id?: string
      token?: string
      unidad_id?: string
      unidad_ids?: string[]
      votante_email?: string
      votante_nombre?: string
      votos?: Array<{ pregunta_id: string; opcion_id: string }>
    }

    const validUUID = /^[0-9a-f-]{36}$/i
    const idsFromBody = Array.isArray(unidad_ids)
      ? unidad_ids.filter((x) => typeof x === 'string' && validUUID.test(x.trim())).map((x) => x.trim())
      : []
    const unidadIds = idsFromBody.length > 0 ? idsFromBody : unidad_id && validUUID.test(unidad_id.trim()) ? [unidad_id.trim()] : []

    if (
      !asamblea_id || !token || unidadIds.length === 0 ||
      !Array.isArray(votos) || votos.length === 0 ||
      !validUUID.test(asamblea_id.trim()) ||
      !validUUID.test(token.trim())
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

    const { data: unidadesRows } = await admin
      .from('unidades')
      .select('id, organization_id, email, email_propietario, nombre_propietario')
      .in('id', unidadIds)
      .eq('organization_id', asamblea.organization_id)

    if (!unidadesRows || unidadesRows.length !== unidadIds.length) {
      return NextResponse.json({ error: 'Una o más unidades no son válidas para esta asamblea' }, { status: 400 })
    }

    const unidadesById = new Map(unidadesRows.map((u) => [u.id, u]))

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

    const userAgentAudit = '[Registrado por asistente delegado]'
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      null

    type RpcResult = { unidad_id: string; pregunta_id: string; success: boolean; error?: string }
    const tareas: Array<{ unidadId: string; v: { pregunta_id: string; opcion_id: string } }> = []
    for (const uid of unidadIds) {
      for (const v of votos) {
        tareas.push({ unidadId: uid, v })
      }
    }

    const CONCURRENCY = 12
    const results: RpcResult[] = []
    for (let i = 0; i < tareas.length; i += CONCURRENCY) {
      const chunk = tareas.slice(i, i + CONCURRENCY)
      const chunkOut = await Promise.all(
        chunk.map(async ({ unidadId, v }) => {
          const unidad = unidadesById.get(unidadId)
          const email = String(
            votante_email || unidad?.email_propietario || unidad?.email || `unidad-${unidadId}@registro-delegado.local`
          )
            .toLowerCase()
            .trim()
          const nombre = (votante_nombre || unidad?.nombre_propietario || 'Residente').trim()
          const nombreAudit = `${nombre} (registrado por asistente delegado)`

          const { error } = await admin.rpc('registrar_voto_con_trazabilidad', {
            p_pregunta_id: v.pregunta_id,
            p_unidad_id: unidadId,
            p_opcion_id: v.opcion_id,
            p_votante_email: email,
            p_votante_nombre: nombreAudit,
            p_es_poder: false,
            p_poder_id: null,
            p_ip_address: ip,
            p_user_agent: userAgentAudit,
          })

          if (error) {
            return {
              unidad_id: unidadId,
              pregunta_id: v.pregunta_id,
              success: false,
              error: error.message,
            } as RpcResult
          }
          return { unidad_id: unidadId, pregunta_id: v.pregunta_id, success: true } as RpcResult
        })
      )
      results.push(...chunkOut)
    }

    const allOk = results.every((r) => r.success)
    const okCount = results.filter((r) => r.success).length
    return NextResponse.json(
      {
        success: allOk,
        results,
        total_intentos: results.length,
        total_ok: okCount,
        message: allOk
          ? 'Votos registrados correctamente'
          : `Registro parcial: ${okCount}/${results.length} votos`,
      },
      { status: allOk ? 200 : 207 }
    )
  } catch (e) {
    console.error('delegado/registrar-voto:', e)
    return NextResponse.json({ error: 'Error al registrar voto' }, { status: 500 })
  }
}
