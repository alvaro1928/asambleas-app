import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { logRouteError, publicErrorMessage } from '@/lib/route-errors'

/**
 * POST /api/dashboard/reabrir-asamblea
 * Reabre una asamblea finalizada. Sin cobro de tokens (el modelo de cobro por LOPD en sesión sustituye cargos al activar/reabrir).
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

    const { data: byUser } = await admin.from('profiles').select('tokens_disponibles').eq('user_id', session.user.id)
    const { data: byId } = await admin.from('profiles').select('tokens_disponibles').eq('id', session.user.id)
    const allTokens = [
      ...(Array.isArray(byUser) ? byUser : byUser ? [byUser] : []),
      ...(Array.isArray(byId) ? byId : byId ? [byId] : []),
    ].map((p: { tokens_disponibles?: number }) => Math.max(0, Number(p?.tokens_disponibles ?? 0)))
    const tokensActuales = allTokens.length ? Math.max(...allTokens) : 0

    const activated_at = new Date().toISOString()
    const { error: updateAsamblea } = await admin
      .from('asambleas')
      .update({ estado: 'activa', activated_at, pago_realizado: true })
      .eq('id', asamblea_id)

    if (updateAsamblea) {
      return NextResponse.json({ error: updateAsamblea.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      estado: 'activa',
      activated_at,
      tokens_restantes: tokensActuales,
      costo_reapertura: 0,
    })
  } catch (e) {
    logRouteError('api/dashboard/reabrir-asamblea', e)
    return NextResponse.json(
      { error: publicErrorMessage(e, 'Error al reabrir la asamblea') },
      { status: 500 }
    )
  }
}
