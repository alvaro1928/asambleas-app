import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/votar/consentimiento?codigo=XXX&identificador=YYY
 * Aceptación LOPD para la sesión actual (session_seq de la asamblea).
 */
export async function GET(request: NextRequest) {
  try {
    const codigo = request.nextUrl.searchParams.get('codigo')
    const identificador = request.nextUrl.searchParams.get('identificador')
    if (!codigo?.trim() || !identificador?.trim()) {
      return NextResponse.json({ error: 'Faltan codigo o identificador' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const { data: asamblea } = await admin
      .from('asambleas')
      .select('id, session_seq')
      .eq('codigo_acceso', codigo.trim().toUpperCase())
      .maybeSingle()

    if (!asamblea?.id) {
      return NextResponse.json({ accepted: false })
    }

    const sessionSeq = Number((asamblea as { session_seq?: number }).session_seq ?? 1)

    const idNorm = identificador.trim().toLowerCase()
    const { data: row } = await admin
      .from('consentimiento_tratamiento_datos')
      .select('id, accepted_at')
      .eq('asamblea_id', asamblea.id)
      .eq('identificador', idNorm)
      .eq('session_seq', sessionSeq)
      .maybeSingle()

    return NextResponse.json({
      accepted: !!row,
      accepted_at: row?.accepted_at ?? null,
      session_seq: sessionSeq,
    })
  } catch (e) {
    console.error('GET /api/votar/consentimiento:', e)
    return NextResponse.json({ error: 'Error al consultar consentimiento' }, { status: 500 })
  }
}

/**
 * POST /api/votar/consentimiento
 * Body: { codigo, identificador, ip? }
 * RPC atómica: consentimiento + consumos por umbral + billetera gestor.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codigo, identificador, ip, contexto, registro_externo } = body as {
      codigo?: string
      identificador?: string
      ip?: string
      contexto?: string
      /** Solo registro de poderes: quien no está en censo (apoderado externo) */
      registro_externo?: boolean
    }
    if (!codigo?.trim() || !identificador?.trim()) {
      return NextResponse.json({ error: 'Faltan codigo o identificador' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const esRegistroPoderes = contexto === 'registro_poderes'

    const { data: rpcData, error: rpcError } = esRegistroPoderes
      ? await admin.rpc('registrar_consentimiento_registro_poderes', {
          p_codigo: codigo.trim().toUpperCase(),
          p_identificador: identificador.trim(),
          p_ip: typeof ip === 'string' ? ip : null,
          p_registro_externo: !!registro_externo,
        })
      : await admin.rpc('registrar_consentimiento_y_consumo_sesion', {
          p_codigo: codigo.trim().toUpperCase(),
          p_identificador: identificador.trim(),
          p_ip: typeof ip === 'string' ? ip : null,
        })

    if (rpcError) {
      console.error(
        esRegistroPoderes ? 'registrar_consentimiento_registro_poderes' : 'registrar_consentimiento_y_consumo_sesion',
        rpcError
      )
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const result = rpcData as Record<string, unknown> | null
    if (!result || result.ok !== true) {
      const code = typeof result?.code === 'string' ? result.code : 'ERROR'
      const message = typeof result?.message === 'string' ? result.message : 'No se pudo registrar el consentimiento'
      const status =
        code === 'SESSION_INACTIVE' || code === 'ACCESO_CERRADO' || code === 'REGISTRO_PODERES_CERRADO'
          ? 409
          : code === 'INSUFFICIENT_TOKENS'
            ? 402
            : code === 'VOTANTE_INVALIDO' || code === 'SIN_UNIDADES'
              ? 403
              : 400
      return NextResponse.json(
        {
          error: message,
          code,
          requerido: result?.requerido,
          saldo: result?.saldo,
        },
        { status }
      )
    }

    return NextResponse.json({
      ok: true,
      session_seq: result.session_seq,
      tokens_cobrados: result.tokens_cobrados,
      unidades: result.unidades,
    })
  } catch (e) {
    console.error('POST /api/votar/consentimiento:', e)
    return NextResponse.json({ error: 'Error al registrar consentimiento' }, { status: 500 })
  }
}
