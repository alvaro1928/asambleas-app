import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCostoEnTokens } from '@/lib/costo-tokens'

/** Porcentaje del costo inicial que se cobra al reabrir (10%) */
const PORCENTAJE_REAPERTURA = 0.1

/**
 * POST /api/dashboard/reabrir-asamblea
 * Reabre una asamblea finalizada. Consume tokens (10% del costo de activación, mínimo 1).
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

    const { data: asambleaRow, error: asambleaError } = await admin
      .from('asambleas')
      .select('*')
      .eq('id', asamblea_id)
      .maybeSingle()

    if (asambleaError || !asambleaRow) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const asamblea = asambleaRow as {
      organization_id?: string
      estado?: string
      is_demo?: boolean
    }
    const orgId = asamblea.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Asamblea sin conjunto' }, { status: 400 })
    }

    if (asamblea.is_demo === true) {
      return NextResponse.json({ error: 'No se puede reabrir una asamblea de demostración' }, { status: 400 })
    }

    if (asamblea.estado !== 'finalizada') {
      return NextResponse.json({ error: 'Solo se puede reabrir una asamblea finalizada' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!profile) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!byId) {
        return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
      }
    }

    const { count: unidadesCount } = await admin
      .from('unidades')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_demo', false)

    const unidades = Math.max(0, unidadesCount ?? 0)
    const costoInicial = getCostoEnTokens(unidades)
    const costoReapertura = Math.max(1, Math.ceil(costoInicial * PORCENTAJE_REAPERTURA))

    const { data: byUser } = await admin.from('profiles').select('tokens_disponibles').eq('user_id', session.user.id)
    const { data: byId } = await admin.from('profiles').select('tokens_disponibles').eq('id', session.user.id)
    const allTokens = [
      ...(Array.isArray(byUser) ? byUser : byUser ? [byUser] : []),
      ...(Array.isArray(byId) ? byId : byId ? [byId] : []),
    ].map((p: { tokens_disponibles?: number }) => Math.max(0, Number(p?.tokens_disponibles ?? 0)))
    const tokensActuales = allTokens.length ? Math.max(...allTokens) : 0

    if (tokensActuales < costoReapertura) {
      return NextResponse.json(
        {
          error: `Saldo insuficiente para reabrir: necesitas ${costoReapertura} tokens (10% del costo de activación) y tienes ${tokensActuales}.`,
          code: 'SIN_TOKENS',
          costo_reapertura: costoReapertura,
          saldo: tokensActuales,
        },
        { status: 402 }
      )
    }

    const nuevoSaldo = Math.max(0, tokensActuales - costoReapertura)

    const { error: updateByUser } = await admin
      .from('profiles')
      .update({ tokens_disponibles: nuevoSaldo })
      .eq('user_id', session.user.id)
    let updateError = updateByUser
    if (updateError) {
      const { error: updateById } = await admin
        .from('profiles')
        .update({ tokens_disponibles: nuevoSaldo })
        .eq('id', session.user.id)
      updateError = updateById
    }
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const activated_at = new Date().toISOString()
    const { error: updateAsamblea } = await admin
      .from('asambleas')
      .update({ estado: 'activa', activated_at })
      .eq('id', asamblea_id)

    if (updateAsamblea) {
      return NextResponse.json({ error: updateAsamblea.message }, { status: 500 })
    }

    try {
      await admin.from('billing_logs').insert({
        user_id: session.user.id,
        tipo_operacion: 'Reapertura asamblea',
        asamblea_id,
        organization_id: orgId,
        tokens_usados: costoReapertura,
        saldo_restante: nuevoSaldo,
        metadata: { unidades, costo_inicial: costoInicial, porcentaje: PORCENTAJE_REAPERTURA },
      })
    } catch (e) {
      console.error('billing_logs insert:', e)
    }

    return NextResponse.json({
      ok: true,
      estado: 'activa',
      activated_at,
      tokens_restantes: nuevoSaldo,
      costo_reapertura: costoReapertura,
    })
  } catch (e) {
    console.error('reabrir-asamblea:', e)
    return NextResponse.json({ error: 'Error al reabrir la asamblea' }, { status: 500 })
  }
}
