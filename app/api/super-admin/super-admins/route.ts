import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessSuperAdminEmail } from '@/lib/super-admin'

function isPrincipalSuperAdmin(email: string | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  const primaryA = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
  const primaryB = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
  if (!primaryA && !primaryB) return false
  return normalized === primaryA || normalized === primaryB
}

async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
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

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

export async function GET() {
  try {
    const supabase = await createAuthClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!(await canAccessSuperAdminEmail(supabase, session.user.email))) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('super_admin_accounts')
      .select('id, email, full_name, active, created_at, updated_at')
      .order('email', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      principal_email: process.env.SUPER_ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? null,
      super_admins: data ?? [],
    })
  } catch (e) {
    console.error('super-admin/super-admins GET:', e)
    return NextResponse.json({ error: 'Error al listar super admins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!isPrincipalSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Solo el super admin principal puede gestionar cuentas.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('super_admin_accounts')
      .upsert(
        {
          email,
          full_name: fullName || null,
          active: true,
          created_by_email: session.user.email.toLowerCase(),
          updated_by_email: session.user.email.toLowerCase(),
        },
        { onConflict: 'email' }
      )
      .select('id, email, full_name, active, created_at, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, super_admin: data })
  } catch (e) {
    console.error('super-admin/super-admins POST:', e)
    return NextResponse.json({ error: 'Error al crear super admin' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAuthClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!isPrincipalSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Solo el super admin principal puede gestionar cuentas.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : ''
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : undefined
    const active = typeof body?.active === 'boolean' ? body.active : undefined

    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const updates: Record<string, unknown> = {
      updated_by_email: session.user.email.toLowerCase(),
    }
    if (fullName !== undefined) updates.full_name = fullName || null
    if (active !== undefined) updates.active = active

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('super_admin_accounts')
      .update(updates)
      .eq('id', id)
      .select('id, email, full_name, active, created_at, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, super_admin: data })
  } catch (e) {
    console.error('super-admin/super-admins PATCH:', e)
    return NextResponse.json({ error: 'Error al actualizar super admin' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createAuthClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!isPrincipalSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Solo el super admin principal puede gestionar cuentas.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('super_admin_accounts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('super-admin/super-admins DELETE:', e)
    return NextResponse.json({ error: 'Error al eliminar super admin' }, { status: 500 })
  }
}
