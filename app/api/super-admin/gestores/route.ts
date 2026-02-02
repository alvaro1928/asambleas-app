import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccess(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/**
 * GET /api/super-admin/gestores
 * Lista todas las cuentas con perfil (incl. owner, admin, member) y su saldo de tokens.
 * Así el super admin ve su propia cuenta y puede asignar tokens a cualquiera.
 * Un usuario puede tener varios perfiles (uno por conjunto); se devuelve uno por user_id con su saldo.
 */
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
    if (!canAccess(session.user.email)) {
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

    // Sin filtrar por rol: listar todos los perfiles para que el super admin vea todas las cuentas (incl. la suya)
    const { data: rows, error: selectError } = await admin
      .from('profiles')
      .select('user_id, id, email, full_name, tokens_disponibles')
      .order('tokens_disponibles', { ascending: false })

    if (selectError) {
      const fallback = await admin
        .from('profiles')
        .select('id, email, full_name, tokens_disponibles')
        .order('tokens_disponibles', { ascending: false })
      if (fallback.error) {
        console.error('super-admin gestores GET:', fallback.error)
        return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      }
      const byUserId = new Map<string, { user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }>()
      for (const row of fallback.data ?? []) {
        const r = row as { id?: string; email?: string | null; full_name?: string | null; tokens_disponibles?: number }
        const uid = r.id
        if (!uid) continue
        if (byUserId.has(uid)) continue
        byUserId.set(uid, {
          user_id: uid,
          email: r.email ?? null,
          full_name: r.full_name ?? null,
          tokens_disponibles: Math.max(0, Number(r.tokens_disponibles ?? 0)),
        })
      }
      return NextResponse.json({ gestores: Array.from(byUserId.values()) })
    }

    const byUserId = new Map<string, { user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }>()
    for (const row of rows ?? []) {
      const r = row as { user_id?: string; id?: string; email?: string | null; full_name?: string | null; tokens_disponibles?: number }
      const uid = r.user_id ?? r.id
      if (!uid) continue
      if (byUserId.has(uid)) continue
      byUserId.set(uid, {
        user_id: uid,
        email: r.email ?? null,
        full_name: r.full_name ?? null,
        tokens_disponibles: Math.max(0, Number(r.tokens_disponibles ?? 0)),
      })
    }

    const gestores = Array.from(byUserId.values())
    return NextResponse.json({ gestores })
  } catch (e) {
    console.error('super-admin gestores GET:', e)
    return NextResponse.json({ error: 'Error al listar gestores' }, { status: 500 })
  }
}

/**
 * PATCH /api/super-admin/gestores
 * Body: { user_id: string, tokens_disponibles: number }
 * Actualiza el saldo de tokens del gestor en todas sus filas de profiles (por user_id o por id legacy).
 */
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
    if (!canAccess(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { user_id, tokens_disponibles } = body as { user_id?: string; tokens_disponibles?: number }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'Falta user_id del gestor' }, { status: 400 })
    }
    const value = Math.max(0, Math.round(Number(tokens_disponibles)))
    if (Number.isNaN(value)) {
      return NextResponse.json({ error: 'tokens_disponibles debe ser un número' }, { status: 400 })
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

    let { error } = await admin
      .from('profiles')
      .update({ tokens_disponibles: value })
      .eq('user_id', user_id)

    if (error) {
      const { data: byId } = await admin
        .from('profiles')
        .select('id')
        .eq('id', user_id)
        .limit(1)
      if (byId && (Array.isArray(byId) ? byId.length : 1)) {
        const { error: errId } = await admin
          .from('profiles')
          .update({ tokens_disponibles: value })
          .eq('id', user_id)
        if (!errId) return NextResponse.json({ ok: true })
      }
      console.error('super-admin gestores PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('super-admin gestores PATCH:', e)
    return NextResponse.json({ error: 'Error al actualizar tokens del gestor' }, { status: 500 })
  }
}
