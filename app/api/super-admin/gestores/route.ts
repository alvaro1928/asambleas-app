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

    // 1) Intentar listar desde profiles (varias variantes por esquema)
    let gestores: Array<{ user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }> = []

    const trySelect = async (select: string, orderBy?: string) => {
      let q = admin.from('profiles').select(select)
      if (orderBy) q = q.order(orderBy, { ascending: false })
      const { data, error } = await q
      return { data, error }
    }

    const buildFromRows = (rows: unknown[], getId: (r: unknown) => string | undefined, getEmail: (r: unknown) => string | null, getFullName: (r: unknown) => string | null, getTokens: (r: unknown) => number) => {
      const byUserId = new Map<string, { user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }>()
      for (const row of rows) {
        const uid = getId(row)
        if (!uid) continue
        if (byUserId.has(uid)) continue
        byUserId.set(uid, {
          user_id: uid,
          email: getEmail(row),
          full_name: getFullName(row),
          tokens_disponibles: getTokens(row),
        })
      }
      return Array.from(byUserId.values())
    }

    const { data: rows1, error: e1 } = await trySelect('user_id, id, email, full_name, tokens_disponibles', 'tokens_disponibles')
    if (!e1 && rows1 && rows1.length > 0) {
      gestores = buildFromRows(
        rows1,
        (r) => (r as { user_id?: string; id?: string }).user_id ?? (r as { id?: string }).id,
        (r) => (r as { email?: string | null }).email ?? null,
        (r) => (r as { full_name?: string | null }).full_name ?? null,
        (r) => Math.max(0, Number((r as { tokens_disponibles?: number }).tokens_disponibles ?? 0))
      )
    }

    if (gestores.length === 0) {
      const { data: rows2, error: e2 } = await trySelect('id, email, full_name, tokens_disponibles', 'tokens_disponibles')
      if (!e2 && rows2 && rows2.length > 0) {
        gestores = buildFromRows(
          rows2,
          (r) => (r as { id?: string }).id,
          (r) => (r as { email?: string | null }).email ?? null,
          (r) => (r as { full_name?: string | null }).full_name ?? null,
          (r) => Math.max(0, Number((r as { tokens_disponibles?: number }).tokens_disponibles ?? 0))
        )
      }
    }

    if (gestores.length === 0) {
      const { data: rows3, error: e3 } = await trySelect('id, email, full_name')
      if (!e3 && rows3 && rows3.length > 0) {
        gestores = buildFromRows(
          rows3,
          (r) => (r as { id?: string }).id,
          (r) => (r as { email?: string | null }).email ?? null,
          (r) => (r as { full_name?: string | null }).full_name ?? null,
          () => 0
        )
      }
    }

    // 2) Si sigue vacío: listar usuarios de Auth y cruzar con profiles para tokens
    if (gestores.length === 0) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
        const users = usersData?.users ?? []
        const tokensByUserId: Record<string, number> = {}
        const { data: profileRows } = await admin.from('profiles').select('user_id, id, tokens_disponibles')
        const profileList = Array.isArray(profileRows) ? profileRows : profileRows ? [profileRows] : []
        for (const p of profileList) {
          const row = p as { user_id?: string; id?: string; tokens_disponibles?: number }
          const uid = row.user_id ?? row.id
          if (uid) {
            const tok = Math.max(0, Number(row.tokens_disponibles ?? 0))
            if (tok > (tokensByUserId[uid] ?? 0)) tokensByUserId[uid] = tok
          }
        }
        const { data: profileById } = await admin.from('profiles').select('id, tokens_disponibles')
        const byIdList = Array.isArray(profileById) ? profileById : profileById ? [profileById] : []
        for (const p of byIdList) {
          const row = p as { id?: string; tokens_disponibles?: number }
          if (row.id) {
            const tok = Math.max(0, Number(row.tokens_disponibles ?? 0))
            if (tok > (tokensByUserId[row.id] ?? 0)) tokensByUserId[row.id] = tok
          }
        }
        gestores = users.map((u) => ({
          user_id: u.id,
          email: u.email ?? null,
          full_name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? null,
          tokens_disponibles: tokensByUserId[u.id] ?? 0,
        }))
      } catch (authErr) {
        console.error('super-admin gestores listUsers fallback:', authErr)
      }
    }

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
