import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/dashboard/descontar-token-asamblea-pro
 * Histórico: cobraba al activar la asamblea (costo = unidades del conjunto).
 * Modelo actual: no se descuenta al activar; el cobro por unidad va al aceptar LOPD en sesión (ver RPC registrar_consentimiento_y_consumo_sesion).
 * Esta ruta se mantiene por compatibilidad con el panel: marca la asamblea como "habilitada" sin descontar tokens.
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

    const asamblea = asambleaRow as { organization_id?: string; estado?: string; is_demo?: boolean }
    const orgId = asamblea.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Asamblea sin conjunto' }, { status: 400 })
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

    const estado = asamblea.estado
    if (estado !== 'borrador') {
      return NextResponse.json({ ok: true, descontado: false, motivo: 'asamblea_ya_activada', pago_realizado: true })
    }

    const { data: byUser } = await admin.from('profiles').select('tokens_disponibles').eq('user_id', session.user.id)
    const { data: byId } = await admin.from('profiles').select('tokens_disponibles').eq('id', session.user.id)
    const allTokens = [
      ...(Array.isArray(byUser) ? byUser : byUser ? [byUser] : []),
      ...(Array.isArray(byId) ? byId : byId ? [byId] : []),
    ].map((p: { tokens_disponibles?: number }) => Math.max(0, Number(p?.tokens_disponibles ?? 0)))
    const saldo = allTokens.length ? Math.max(...allTokens) : 0

    await admin.from('asambleas').update({ pago_realizado: true }).eq('id', asamblea_id)

    return NextResponse.json({
      ok: true,
      descontado: false,
      motivo: 'sin_cobro_al_activar',
      pago_realizado: true,
      tokens_restantes: saldo,
      unidades: 0,
    })
  } catch (e) {
    console.error('descontar-token-asamblea-pro:', e)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
