import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type StatsVerif = {
  total_verificados: number
  coeficiente_verificado: number
  porcentaje_verificado: number
  quorum_alcanzado: boolean
}

/**
 * POST /api/votar/estado-verificacion
 * Body: { codigo: string, email?: string, soloFlags?: boolean }
 *
 * Devuelve flags de verificación de asistencia y (salvo soloFlags) estadísticas de quórum
 * usando service_role — mismo problema que preguntas: lecturas desde el cliente con JWT
 * `authenticated` de otra org quedan vacías por RLS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      codigo,
      email,
      soloFlags,
    } = body as { codigo?: string; email?: string; soloFlags?: boolean }

    if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
      return NextResponse.json({ error: 'Falta codigo' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: codigoData, error: codigoError } = await admin.rpc('validar_codigo_acceso', {
      p_codigo: codigo.trim(),
    })

    if (
      codigoError ||
      !codigoData ||
      codigoData.length === 0 ||
      !codigoData[0]?.acceso_valido
    ) {
      return NextResponse.json({ ok: false, error: 'Código inválido o acceso cerrado' }, { status: 403 })
    }

    const asambleaId = codigoData[0].asamblea_id as string

    const { data: aRow, error: aErr } = await admin
      .from('asambleas')
      .select(
        'verificacion_asistencia_activa, verificacion_pregunta_id, participacion_timer_end_at, participacion_timer_default_minutes, participacion_timer_enabled'
      )
      .eq('id', asambleaId)
      .single()

    if (aErr || !aRow) {
      console.error('[estado-verificacion] asambleas:', aErr)
      return NextResponse.json({ error: 'No se pudo leer la asamblea' }, { status: 500 })
    }

    /** Solo verificación general (asamblea completa). Se ignora verificacion_pregunta_id en BD para no romper quórum al cambiar de pregunta. */
    const asamblea = {
      verificacion_asistencia_activa: !!(aRow as { verificacion_asistencia_activa?: boolean })
        .verificacion_asistencia_activa,
      verificacion_pregunta_id: null as string | null,
      participacion_timer_end_at:
        (aRow as { participacion_timer_end_at?: string | null }).participacion_timer_end_at ?? null,
      participacion_timer_default_minutes: Number(
        (aRow as { participacion_timer_default_minutes?: number | null }).participacion_timer_default_minutes ?? 5
      ) || 5,
      participacion_timer_enabled: !(
        (aRow as { participacion_timer_enabled?: boolean | null }).participacion_timer_enabled === false
      ),
    }

    if (soloFlags) {
      return NextResponse.json(
        { ok: true, asamblea },
        {
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      )
    }

    const activa = asamblea.verificacion_asistencia_activa
    const preguntaId: string | null = null

    let vData: StatsVerif[] | null = null
    if (activa) {
      const vRes = await admin.rpc('calcular_verificacion_quorum', {
        p_asamblea_id: asambleaId,
        p_pregunta_id: preguntaId,
        p_solo_sesion_actual: true,
      })
      if (vRes.data?.length) {
        const v = vRes.data[0] as {
          total_verificados?: number
          coeficiente_verificado?: number
          porcentaje_verificado?: number
          quorum_alcanzado?: boolean
        }
        vData = [
          {
            total_verificados: Number(v.total_verificados) || 0,
            coeficiente_verificado: Number(v.coeficiente_verificado) || 0,
            porcentaje_verificado: Number(v.porcentaje_verificado) || 0,
            quorum_alcanzado: !!v.quorum_alcanzado,
          },
        ]
      }
    } else {
      const { data: ultimaSesion } = await admin
        .from('verificacion_asamblea_sesiones')
        .select('total_verificados, coeficiente_verificado, porcentaje_verificado, quorum_alcanzado')
        .eq('asamblea_id', asambleaId)
        .is('pregunta_id', null)
        .not('cierre_at', 'is', null)
        .order('cierre_at', { ascending: false })
        .limit(1)

      if (ultimaSesion?.length) {
        const u = ultimaSesion[0] as {
          total_verificados?: number
          coeficiente_verificado?: number
          porcentaje_verificado?: number
          quorum_alcanzado?: boolean
        }
        vData = [
          {
            total_verificados: Number(u.total_verificados) ?? 0,
            coeficiente_verificado: Number(u.coeficiente_verificado) ?? 0,
            porcentaje_verificado: Number(u.porcentaje_verificado) ?? 0,
            quorum_alcanzado: !!u.quorum_alcanzado,
          },
        ]
      }
    }

    const emailTrim = typeof email === 'string' ? email.trim() : ''
    let yaVerificoRaw: boolean | null = null
    if (emailTrim) {
      const yaRes = await admin.rpc('ya_verifico_asistencia', {
        p_asamblea_id: asambleaId,
        p_email: emailTrim,
        p_pregunta_id: preguntaId,
      })
      const val = yaRes.data
      yaVerificoRaw = Array.isArray(val) ? val[0] === true : val === true
    }

    return NextResponse.json(
      {
        ok: true,
        asamblea,
        vData,
        yaVerificoRaw,
        statsVerificacionPorPregunta: {} as Record<string, StatsVerif>,
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  } catch (e) {
    console.error('POST /api/votar/estado-verificacion:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
