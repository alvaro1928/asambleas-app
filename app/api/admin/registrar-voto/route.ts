import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
/**
 * POST /api/admin/registrar-voto
 * Modelo Billetera de Tokens por Gestor.
 * Permite al administrador registrar votos individuales o masivos por unidad.
 * No consume tokens; solo registra trazabilidad "registrado por administrador".
 * Body:
 * - Modo individual: { asamblea_id, unidad_id, votante_email?, votante_nombre?, votos: [{ pregunta_id, opcion_id }] }
 * - Modo masivo:     { asamblea_id, unidad_ids: string[], votante_nombre?, votos: [{ pregunta_id, opcion_id }] }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      asamblea_id,
      unidad_id,
      unidad_ids,
      votante_email,
      votante_nombre,
      votos,
    } = body as {
      asamblea_id?: string
      unidad_id?: string
      unidad_ids?: string[]
      votante_email?: string
      votante_nombre?: string
      votos?: Array<{ pregunta_id: string; opcion_id: string }>
    }

    const unidadIds = Array.isArray(unidad_ids)
      ? unidad_ids.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
      : (unidad_id ? [unidad_id] : [])

    if (!asamblea_id || unidadIds.length === 0 || !Array.isArray(votos) || votos.length === 0) {
      return NextResponse.json(
        { error: 'Faltan asamblea_id, unidad_id/unidad_ids o votos (array de { pregunta_id, opcion_id })' },
        { status: 400 }
      )
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Verificar que el usuario tiene acceso al conjunto de la asamblea
    const { data: asambleaRow } = await admin
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', asamblea_id)
      .single()

    if (!asambleaRow) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    /** profiles puede usar user_id o id = auth.uid() según migración */
    const { data: profilesByUserId } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('user_id', session.user.id)
    const { data: profilesById } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', session.user.id)
    const userOrgIds = [
      ...((profilesByUserId ?? []) as { organization_id?: string }[]),
      ...((profilesById ?? []) as { organization_id?: string }[]),
    ]
      .map((p) => p.organization_id)
      .filter(Boolean) as string[]
    const orgSet = new Set(userOrgIds)
    if (!orgSet.has(asambleaRow.organization_id)) {
      return NextResponse.json({ error: 'No tienes acceso a esta asamblea' }, { status: 403 })
    }

    // No se exigen tokens para registrar votos (solo para activar asamblea y generar acta).

    // Unidades con service_role (evita RLS incompleto con sesión del gestor)
    const { data: unidadesRows } = await admin
      .from('unidades')
      .select('id, organization_id, email, email_propietario, nombre_propietario')
      .in('id', unidadIds)

    if (!unidadesRows || unidadesRows.length !== unidadIds.length) {
      return NextResponse.json({ error: 'Una o más unidades no son válidas para esta asamblea' }, { status: 400 })
    }

    if (unidadesRows.some((u) => u.organization_id !== asambleaRow.organization_id)) {
      return NextResponse.json({ error: 'Una o más unidades no pertenecen al conjunto de la asamblea' }, { status: 400 })
    }

    // Verificar que cada pregunta pertenece a la asamblea y está abierta
    const { data: preguntas } = await admin
      .from('preguntas')
      .select('id, estado')
      .eq('asamblea_id', asamblea_id)

    const preguntasAbiertas = new Set(
      (preguntas ?? []).filter((p) => p.estado === 'abierta').map((p) => p.id)
    )
    const preguntasIdsAsamblea = new Set((preguntas ?? []).map((p) => p.id))

    for (const v of votos) {
      if (!v.pregunta_id || !v.opcion_id) {
        return NextResponse.json({ error: 'Cada voto debe tener pregunta_id y opcion_id' }, { status: 400 })
      }
      if (!preguntasIdsAsamblea.has(v.pregunta_id)) {
        return NextResponse.json({ error: 'Una pregunta no pertenece a esta asamblea' }, { status: 400 })
      }
      if (!preguntasAbiertas.has(v.pregunta_id)) {
        return NextResponse.json({
          error: 'Solo se pueden registrar votos en preguntas con votación abierta',
        }, { status: 400 })
      }
    }

    const nombreBase = (votante_nombre || 'Residente').trim()
    const userAgent = '[Registrado por administrador]'
    const adminIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-client-ip') ||
      request.headers.get('cf-connecting-ip') ||
      null

    type RpcResult = { unidad_id: string; pregunta_id: string; success: boolean; error?: string }
    const unidadesById = new Map(unidadesRows.map((u) => [u.id, u]))

    const tareas: Array<{ unidadId: string; v: { pregunta_id: string; opcion_id: string } }> = []
    for (const unidadId of unidadIds) {
      for (const v of votos) {
        tareas.push({ unidadId, v })
      }
    }

    /** Varios RPC en paralelo (misma asamblea) para no bloquear minutos en lotes grandes */
    const CONCURRENCY = 12
    const results: RpcResult[] = []
    for (let i = 0; i < tareas.length; i += CONCURRENCY) {
      const chunk = tareas.slice(i, i + CONCURRENCY)
      const chunkOut = await Promise.all(
        chunk.map(async ({ unidadId, v }) => {
          const u = unidadesById.get(unidadId)
          const emailUnidad = String(
            votante_email || u?.email_propietario || u?.email || `unidad-${unidadId}@registro-admin.local`
          )
            .toLowerCase()
            .trim()
          const nombreUnidad = (u?.nombre_propietario || nombreBase || 'Residente').trim()
          const nombreAudit = `${nombreUnidad} (registrado por administrador)`

          const { error } = await admin.rpc('registrar_voto_con_trazabilidad', {
            p_pregunta_id: v.pregunta_id,
            p_unidad_id: unidadId,
            p_opcion_id: v.opcion_id,
            p_votante_email: emailUnidad,
            p_votante_nombre: nombreAudit,
            p_es_poder: false,
            p_poder_id: null,
            p_ip_address: adminIp,
            p_user_agent: userAgent,
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

    // No se restan tokens al administrador cuando registra votos por una unidad.
    // Consumo típico de tokens: aceptación LOPD en sesión de votación pública (RPC registrar_consentimiento_y_consumo_sesion), acta, WhatsApp masivo, etc.

    return NextResponse.json({
      success: allOk,
      results,
      total_intentos: results.length,
      total_ok: okCount,
      message: allOk
        ? 'Votos registrados correctamente'
        : `Registro parcial: ${okCount}/${results.length} votos`,
    }, { status: allOk ? 200 : 207 })
  } catch (e) {
    console.error('[api/admin/registrar-voto]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar votos' },
      { status: 500 }
    )
  }
}
