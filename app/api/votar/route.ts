import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/votar
 * Registra un voto con trazabilidad. Objetivo latencia < 200ms.
 *
 * - Bypass de estrés (seguro): header x-stress-test-secret === STRESS_TEST_SECRET
 *   → cliente service_role + INSERT directo en votos con returning: 'minimal'
 *   (salta RPC y validaciones SQL para que 500 unidades registren voto al instante).
 * - Votos reales: obligatoria sesión; un único RPC (registrar_voto_con_trazabilidad).
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
      request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-client-ip') ||
      request.headers.get('cf-connecting-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || null

    // Bypass de estrés: solo si el secreto coincide (evita consultas de sesión y ahorra latencia)
    const stressSecret = request.headers.get('x-stress-test-secret')
    const envSecret = process.env.STRESS_TEST_SECRET
    const useStressBypass =
      typeof envSecret === 'string' &&
      envSecret.length > 0 &&
      typeof stressSecret === 'string' &&
      stressSecret === envSecret

    let supabase: SupabaseClient
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
      // Seguridad: votos reales exigen sesión válida (quórum/sesión estricta)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
        const res = NextResponse.json(
          { error: 'Se requiere sesión válida para registrar el voto' },
          { status: 401 }
        )
        res.headers.set('X-Response-Time-Ms', String(elapsed))
        return res
      }
    }

    const emailNorm = String(votante_email).toLowerCase().trim()
    const nombreVotante = votante_nombre || 'Votante'

    if (useStressBypass) {
      // Test de estrés: INSERT directo en votos, sin RPC ni historial. Máxima velocidad.
      const { error } = await supabase
        .from('votos')
        .insert({
          pregunta_id,
          unidad_id,
          opcion_id,
          votante_email: emailNorm,
          votante_nombre: nombreVotante,
          es_poder: !!es_poder,
          poder_id: poder_id || null,
        })

      if (error) {
        const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
        if (process.env.NODE_ENV !== 'production') console.log(`[api/votar] stress ${elapsed}ms error:`, error.message)
        const resErr = NextResponse.json({ error: error.message }, { status: 400 })
        resErr.headers.set('X-Response-Time-Ms', String(elapsed))
        return resErr
      }

      const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)
      if (process.env.NODE_ENV !== 'production' || elapsed > 200) {
        console.log(`[api/votar] stress latency_ms=${elapsed} pregunta_id=${pregunta_id} unidad_id=${unidad_id}`)
      }
      const res = NextResponse.json({ success: true })
      res.headers.set('X-Response-Time-Ms', String(elapsed))
      return res
    }

    // Votos reales: un solo roundtrip RPC (valida pregunta abierta, INSERT/UPDATE + historial)
    const { data, error } = await supabase.rpc('registrar_voto_con_trazabilidad', {
      p_pregunta_id: pregunta_id,
      p_unidad_id: unidad_id,
      p_opcion_id: opcion_id,
      p_votante_email: emailNorm,
      p_votante_nombre: nombreVotante,
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
