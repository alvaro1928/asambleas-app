import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'

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
    if (!isSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado. Solo super administrador.' }, { status: 403 })
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

    const { data: orgs, error: orgsError } = await admin
      .from('organizations')
      .select('id, name, slug, nit, plan_type, plan_active_until, plan_status, is_pilot, created_at')
      .order('created_at', { ascending: false })

    if (orgsError) {
      console.error('super-admin conjuntos:', orgsError)
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

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

    return NextResponse.json({ conjuntos })
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
    if (!isSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { id, plan_type } = body as { id?: string; plan_type?: string }

    if (!id || !plan_type) {
      return NextResponse.json(
        { error: 'Faltan id o plan_type' },
        { status: 400 }
      )
    }
    if (!['free', 'pro', 'pilot'].includes(plan_type)) {
      return NextResponse.json(
        { error: 'plan_type debe ser free, pro o pilot' },
        { status: 400 }
      )
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

    const { error } = await admin
      .from('organizations')
      .update({ plan_type })
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
