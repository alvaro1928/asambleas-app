import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { planEfectivo } from '@/lib/plan-utils'

/**
 * POST /api/dashboard/descontar-token-asamblea-pro
 * Descuenta 1 token del conjunto cuando se activa una asamblea con más de 2 preguntas
 * (uso Pro). Solo aplica para planes Free/Pilot; Pro es ilimitado.
 * Los tokens son del conjunto (organization); las cuentas (admins) administran conjuntos.
 * Devuelve 200 si se descontó o si no aplica; 402 si no hay tokens.
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
    const { asamblea_id } = body as { asamblea_id?: string }
    if (!asamblea_id) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
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

    const { data: asamblea, error: asambleaError } = await admin
      .from('asambleas')
      .select('id, organization_id, estado')
      .eq('id', asamblea_id)
      .maybeSingle()

    if (asambleaError || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = (asamblea as { organization_id?: string }).organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Asamblea sin conjunto' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    const estado = (asamblea as { estado?: string }).estado
    if (estado !== 'borrador') {
      return NextResponse.json({ ok: true, descontado: false, motivo: 'asamblea_ya_activada' })
    }

    const { count, error: countError } = await admin
      .from('preguntas')
      .select('*', { count: 'exact', head: true })
      .eq('asamblea_id', asamblea_id)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    const numPreguntas = count ?? 0
    if (numPreguntas <= 2) {
      return NextResponse.json({ ok: true, descontado: false, motivo: 'asamblea_basica' })
    }

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('tokens_disponibles, plan_type, plan_active_until')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Conjunto no encontrado' }, { status: 404 })
    }

    const planEf = planEfectivo(
      (org as { plan_type?: string }).plan_type,
      (org as { plan_active_until?: string }).plan_active_until
    )
    const tokens = Math.max(0, Number((org as { tokens_disponibles?: number }).tokens_disponibles ?? 0))

    if (planEf === 'pro') {
      return NextResponse.json({ ok: true, descontado: false, motivo: 'plan_pro_ilimitado' })
    }

    if (tokens < 1) {
      return NextResponse.json(
        { error: 'No tienes tokens disponibles para activar esta asamblea Pro.', code: 'SIN_TOKENS' },
        { status: 402 }
      )
    }

    const { error: updateError } = await admin
      .from('organizations')
      .update({ tokens_disponibles: tokens - 1 })
      .eq('id', orgId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, descontado: true, tokens_restantes: tokens - 1 })
  } catch (e) {
    console.error('descontar-token-asamblea-pro:', e)
    return NextResponse.json({ error: 'Error al descontar token' }, { status: 500 })
  }
}
