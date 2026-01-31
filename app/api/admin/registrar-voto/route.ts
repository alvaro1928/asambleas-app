import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/registrar-voto
 * Permite al administrador registrar uno o varios votos a nombre de un residente
 * (p. ej. personas mayores que no usan tecnología).
 * Body: { asamblea_id, unidad_id, votante_email, votante_nombre, votos: [{ pregunta_id, opcion_id }] }
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
      votante_email,
      votante_nombre,
      votos,
    } = body as {
      asamblea_id?: string
      unidad_id?: string
      votante_email?: string
      votante_nombre?: string
      votos?: Array<{ pregunta_id: string; opcion_id: string }>
    }

    if (!asamblea_id || !unidad_id || !votante_email || !Array.isArray(votos) || votos.length === 0) {
      return NextResponse.json(
        { error: 'Faltan asamblea_id, unidad_id, votante_email o votos (array de { pregunta_id, opcion_id })' },
        { status: 400 }
      )
    }

    // Verificar que el usuario tiene acceso al conjunto de la asamblea
    const { data: asambleaRow } = await supabase
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', asamblea_id)
      .single()

    if (!asambleaRow) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', session.user.id)

    const userOrgIds = (profiles ?? []).map((p) => p.organization_id).filter(Boolean)
    if (!userOrgIds.includes(asambleaRow.organization_id)) {
      return NextResponse.json({ error: 'No tienes acceso a esta asamblea' }, { status: 403 })
    }

    // Verificar que la unidad pertenece al mismo conjunto
    const { data: unidadRow } = await supabase
      .from('unidades')
      .select('id, organization_id')
      .eq('id', unidad_id)
      .single()

    if (!unidadRow || unidadRow.organization_id !== asambleaRow.organization_id) {
      return NextResponse.json({ error: 'Unidad no válida para esta asamblea' }, { status: 400 })
    }

    // Verificar que cada pregunta pertenece a la asamblea y está abierta
    const { data: preguntas } = await supabase
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

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const email = String(votante_email).toLowerCase().trim()
    const nombre = (votante_nombre || 'Residente').trim()
    const nombreAudit = nombre + ' (registrado por administrador)'
    const userAgent = '[Registrado por administrador]'

    const results: Array<{ pregunta_id: string; success: boolean; error?: string }> = []

    for (const v of votos) {
      const { data, error } = await admin.rpc('registrar_voto_con_trazabilidad', {
        p_pregunta_id: v.pregunta_id,
        p_unidad_id: unidad_id,
        p_opcion_id: v.opcion_id,
        p_votante_email: email,
        p_votante_nombre: nombreAudit,
        p_es_poder: false,
        p_poder_id: null,
        p_ip_address: null,
        p_user_agent: userAgent,
      })

      if (error) {
        results.push({ pregunta_id: v.pregunta_id, success: false, error: error.message })
      } else {
        results.push({ pregunta_id: v.pregunta_id, success: true })
      }
    }

    const allOk = results.every((r) => r.success)
    return NextResponse.json({
      success: allOk,
      results,
      message: allOk
        ? 'Votos registrados correctamente'
        : 'Algunos votos no se pudieron registrar',
    }, { status: allOk ? 200 : 207 })
  } catch (e) {
    console.error('[api/admin/registrar-voto]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar votos' },
      { status: 500 }
    )
  }
}
