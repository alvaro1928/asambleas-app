import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccessSuperAdmin(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/** GET: lista todos los conjuntos (solo super admin) */
export async function GET() {
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

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!canAccessSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado. Solo administrador.' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Soporta esquema con o sin plan_type (migración billetera por gestor quita plan_* de organizations)
    let orgs: Array<Record<string, unknown>> | null = null
    let orgsError: Error | null = null
    const fullSelect = await admin
      .from('organizations')
      .select('id, name, slug, nit, plan_type, plan_active_until, plan_status, is_pilot, tokens_disponibles, created_at')
      .order('created_at', { ascending: false })
    orgs = fullSelect.data as Array<Record<string, unknown>> | null
    orgsError = fullSelect.error

    if (orgsError && orgsError.message?.includes('plan_type')) {
      const minimal = await admin
        .from('organizations')
        .select('id, name, slug, nit, created_at')
        .order('created_at', { ascending: false })
      if (minimal.error) {
        console.error('super-admin conjuntos:', minimal.error)
        return NextResponse.json({ error: minimal.error.message }, { status: 500 })
      }
      orgs = (minimal.data || []).map((o) => ({
        ...o,
        plan_type: 'free',
        plan_status: null,
        plan_active_until: null,
        is_pilot: null,
        tokens_disponibles: 0,
      })) as Array<Record<string, unknown>>
    } else if (orgsError) {
      console.error('super-admin conjuntos:', orgsError)
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

    const { data: pagosResumen } = await admin
      .from('pagos_log')
      .select('organization_id, monto')
      .eq('estado', 'APPROVED')

    const conjuntosQuePagaron = new Set((pagosResumen || []).map((r) => (r as { organization_id: string }).organization_id)).size
    const dineroTotalCentavos = (pagosResumen || []).reduce((acc, r) => acc + Number((r as { monto: number }).monto ?? 0), 0)

    const orgIds = (orgs || []).map((o) => o.id)

    const { data: unidades } = await admin
      .from('unidades')
      .select('organization_id')

    const { data: profiles } = await admin
      .from('profiles')
      .select('organization_id, email, role')
      .in('organization_id', orgIds)
      .in('role', ['owner', 'admin'])

    const countByOrg: Record<string, number> = {}
    for (const u of unidades || []) {
      const id = (u as { organization_id: string }).organization_id
      countByOrg[id] = (countByOrg[id] || 0) + 1
    }

    const adminEmailByOrg: Record<string, string> = {}
    const roleOrder = { owner: 0, admin: 1 }
    const sortedProfiles = [...(profiles || [])].sort(
      (a, b) =>
        (roleOrder[(a as { role: string }).role as keyof typeof roleOrder] ?? 2) -
        (roleOrder[(b as { role: string }).role as keyof typeof roleOrder] ?? 2)
    )
    for (const p of sortedProfiles) {
      const row = p as { organization_id: string; email: string | null; role: string }
      if (row.organization_id && row.email && !adminEmailByOrg[row.organization_id]) {
        adminEmailByOrg[row.organization_id] = row.email
      }
    }

    const conjuntos = (orgs || []).map((o) => ({
      ...o,
      unidades_count: countByOrg[o.id] ?? 0,
      admin_email: adminEmailByOrg[o.id] ?? null,
      plan_status: (o as { plan_status?: string }).plan_status ?? null,
    }))

    return NextResponse.json({
      conjuntos,
      resumen: {
        conjuntos_que_pagaron: conjuntosQuePagaron,
        dinero_total_centavos: dineroTotalCentavos,
      },
    })
  } catch (e) {
    console.error('super-admin conjuntos GET:', e)
    return NextResponse.json({ error: 'Error al listar conjuntos' }, { status: 500 })
  }
}

/** PATCH: actualizar plan_type de un conjunto (solo super admin) */
export async function PATCH(request: NextRequest) {
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

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!canAccessSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { id, plan_type, activar_cortesia, tokens_disponibles } = body as {
      id?: string
      plan_type?: string
      activar_cortesia?: boolean
      tokens_disponibles?: number
    }

    if (!id) {
      return NextResponse.json({ error: 'Falta id del conjunto' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Solo actualizar tokens del conjunto (sin cambiar plan). Tokens son del conjunto (organization).
    if (tokens_disponibles !== undefined && plan_type === undefined && !activar_cortesia) {
      const value = Math.max(0, Math.round(Number(tokens_disponibles)))
      const { error } = await admin
        .from('organizations')
        .update({ tokens_disponibles: value })
        .eq('id', id)
      if (error) {
        console.error('super-admin PATCH tokens:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (activar_cortesia) {
      const now = new Date()
      const activeUntil = new Date(now)
      activeUntil.setDate(activeUntil.getDate() + 365)
      const { error } = await admin
        .from('organizations')
        .update({
          plan_type: 'pro',
          subscription_status: 'active',
          plan_active_until: activeUntil.toISOString(),
        })
        .eq('id', id)
      if (error) {
        console.error('super-admin PATCH cortesía:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (!plan_type) {
      return NextResponse.json({ error: 'Faltan plan_type o activar_cortesia' }, { status: 400 })
    }
    if (!['free', 'pro', 'pilot'].includes(plan_type)) {
      return NextResponse.json(
        { error: 'plan_type debe ser free, pro o pilot' },
        { status: 400 }
      )
    }

    const payload: Record<string, unknown> = { plan_type }
    if (plan_type === 'pro' || plan_type === 'pilot') {
      const now = new Date()
      const activeUntil = new Date(now)
      const { data: planRow } = await admin
        .from('planes')
        .select('vigencia_meses')
        .eq('key', plan_type)
        .maybeSingle()
      const vigenciaMeses = planRow != null && typeof (planRow as { vigencia_meses?: number | null }).vigencia_meses === 'number'
        ? Math.max(0, (planRow as { vigencia_meses: number }).vigencia_meses)
        : plan_type === 'pilot' ? 3 : 12
      if (vigenciaMeses > 0) {
        activeUntil.setMonth(activeUntil.getMonth() + vigenciaMeses)
      } else {
        activeUntil.setDate(activeUntil.getDate() + 365)
      }
      payload.subscription_status = 'active'
      payload.plan_active_until = activeUntil.toISOString()
      if (plan_type === 'pro') (payload as Record<string, number | null>).tokens_disponibles = 0
    } else {
      payload.subscription_status = 'inactive'
      payload.plan_active_until = null
    }

    if (plan_type === 'free' || plan_type === 'pilot') {
      let tokensValue: number
      if (typeof tokens_disponibles === 'number' && tokens_disponibles >= 0) {
        tokensValue = Math.max(0, Math.round(tokens_disponibles))
      } else {
        const { data: planRow } = await admin
          .from('planes')
          .select('tokens_iniciales')
          .eq('key', plan_type)
          .maybeSingle()
        const tokensIniciales = planRow != null && typeof (planRow as { tokens_iniciales?: number | null }).tokens_iniciales === 'number'
          ? Math.max(0, (planRow as { tokens_iniciales: number }).tokens_iniciales)
          : plan_type === 'free' ? 2 : 10
        tokensValue = tokensIniciales
      }
      ;(payload as Record<string, number>).tokens_disponibles = tokensValue
    }

    const { error } = await admin
      .from('organizations')
      .update(payload)
      .eq('id', id)

    if (error) {
      console.error('super-admin PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('super-admin conjuntos PATCH:', e)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}
