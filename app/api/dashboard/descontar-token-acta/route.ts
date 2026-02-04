import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/dashboard/descontar-token-acta
 * El cobro de tokens es solo al activar la asamblea (descontar-token-asamblea-pro).
 * Si la asamblea ya tiene pago_realizado, permite generar el acta sin descontar.
 * Si no, devuelve 400: debe activar la asamblea primero.
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

    const asamblea = asambleaRow as { organization_id?: string; pago_realizado?: boolean; is_demo?: boolean }
    const orgId = asamblea.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Asamblea sin conjunto' }, { status: 400 })
    }

    if (asamblea.is_demo === true) {
      return NextResponse.json({
        ok: true,
        ya_pagada: true,
        pago_realizado: true,
        tokens_restantes: 0,
        costo: 0,
      })
    }

    // El cobro es solo al activar la asamblea; activar habilita generar el acta sin nuevo cobro
    if (asamblea.pago_realizado === true) {
      const { data: prof } = await admin.from('profiles').select('tokens_disponibles').eq('user_id', session.user.id).limit(1).maybeSingle()
      const saldo = Math.max(0, Math.floor(Number((prof as { tokens_disponibles?: number } | null)?.tokens_disponibles ?? 0)))
      return NextResponse.json({
        ok: true,
        ya_pagada: true,
        pago_realizado: true,
        tokens_restantes: saldo,
        costo: 0,
      })
    }

    // No se cobra aquí: el cobro es solo al activar la asamblea
    return NextResponse.json(
      { error: 'Debes activar la asamblea primero. El cobro de tokens es una sola vez al activar y eso habilita generar el acta.' },
      { status: 400 }
    )
  } catch (e) {
    console.error('descontar-token-acta:', e)
    return NextResponse.json({ error: 'Error al descontar tokens' }, { status: 500 })
  }
}
