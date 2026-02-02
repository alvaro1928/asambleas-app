import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/votar
 * Registra un voto con trazabilidad (para stress test k6 y uso desde cliente si se desea).
 * Body: { pregunta_id, opcion_id, unidad_id, votante_email, votante_nombre?, es_poder?, poder_id? }
 * Objetivo latencia: < 200ms por voto (landing).
 *
 * Bypass de estrés: si el header x-stress-test-secret coincide con STRESS_TEST_SECRET,
 * se procesa el voto sin validar sesión de Supabase/NextAuth (cliente service_role).
 * Útil para medir latencia real de BD en stress tests (local o producción).
 */
export async function POST(request: NextRequest) {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    const body = await request.json()
    const {
      pregunta_id,
      opcion_id,
      unidad_id,
      votante_email,
      votante_nombre = 'Votante stress test',
      es_poder = false,
      poder_id = null,
    } = body

    if (!pregunta_id || !opcion_id || !unidad_id || !votante_email) {
      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
      const res400 = NextResponse.json(
        { error: 'Faltan pregunta_id, opcion_id, unidad_id o votante_email' },
        { status: 400 }
      )
      res400.headers.set('X-Response-Time-Ms', String(elapsed))
      return res400
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || null

    const stressSecret = request.headers.get('x-stress-test-secret')
    const envSecret = process.env.STRESS_TEST_SECRET
    const useStressBypass =
      typeof envSecret === 'string' &&
      envSecret.length > 0 &&
      typeof stressSecret === 'string' &&
      stressSecret === envSecret

    let supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>
    if (useStressBypass) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!serviceRoleKey || !supabaseUrl) {
        const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
        const res = NextResponse.json({ error: 'Configuración del servidor incompleta para stress test' }, { status: 503 })
        res.headers.set('X-Response-Time-Ms', String(elapsed))
        return res
      }
      supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    } else {
      const cookieStore = await cookies()
      supabase = createServerClient(
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
    }

    const { data, error } = await supabase.rpc('registrar_voto_con_trazabilidad', {
      p_pregunta_id: pregunta_id,
      p_unidad_id: unidad_id,
      p_opcion_id: opcion_id,
      p_votante_email: String(votante_email).toLowerCase().trim(),
      p_votante_nombre: votante_nombre || 'Votante',
      p_es_poder: !!es_poder,
      p_poder_id: poder_id || null,
      p_ip_address: ip,
      p_user_agent: userAgent,
    })

    if (error) {
      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
      if (process.env.NODE_ENV !== 'production') console.log(`[api/votar] ${elapsed}ms error:`, error.message)
      const resErr = NextResponse.json({ error: error.message }, { status: 400 })
      resErr.headers.set('X-Response-Time-Ms', String(elapsed))
      return resErr
    }

    const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
    if (process.env.NODE_ENV !== 'production' || elapsed > 200) {
      console.log(`[api/votar] latency_ms=${elapsed} pregunta_id=${pregunta_id} unidad_id=${unidad_id}`)
    }
    const res = NextResponse.json({ success: true, data: data?.[0] ?? data })
    res.headers.set('X-Response-Time-Ms', String(elapsed))
    return res
  } catch (e) {
    const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
    console.error('[api/votar]', elapsed, 'ms', e)
    const errRes = NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar voto' },
      { status: 500 }
    )
    errRes.headers.set('X-Response-Time-Ms', String(elapsed))
    return errRes
  }
}
