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

    // 1) Listar gestores desde profiles. Soporta esquemas con id (auth user) o user_id.
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

    // Intentar primero con id (estándar Supabase: profiles.id = auth.users.id)
    const { data: rowsId, error: eId } = await trySelect('id, email, full_name, tokens_disponibles', 'tokens_disponibles')
    if (!eId && rowsId && rowsId.length > 0) {
      gestores = buildFromRows(
        rowsId,
        (r) => (r as { id?: string }).id,
        (r) => (r as { email?: string | null }).email ?? null,
        (r) => (r as { full_name?: string | null }).full_name ?? null,
        (r) => Math.max(0, Number((r as { tokens_disponibles?: number }).tokens_disponibles ?? 0))
      )
    }

    if (gestores.length === 0) {
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

    // 2) Si sigue vacío: listar usuarios de Auth y cruzar con profiles (solo id + tokens por compatibilidad)
    if (gestores.length === 0) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
        const users = usersData?.users ?? []
        const tokensByUserId: Record<string, number> = {}
        const { data: profileById, error: errProf } = await admin.from('profiles').select('id, tokens_disponibles')
        if (!errProf && profileById && profileById.length > 0) {
          for (const p of profileById) {
            const row = p as { id?: string; tokens_disponibles?: number }
            if (row.id) {
              const tok = Math.max(0, Number(row.tokens_disponibles ?? 0))
              if (tok > (tokensByUserId[row.id] ?? 0)) tokensByUserId[row.id] = tok
            }
          }
        }
        const { data: profileUser } = await admin.from('profiles').select('user_id, tokens_disponibles')
        if (profileUser && profileUser.length > 0) {
          for (const p of profileUser) {
            const row = p as { user_id?: string; tokens_disponibles?: number }
            if (row.user_id) {
              const tok = Math.max(0, Number(row.tokens_disponibles ?? 0))
              if (tok > (tokensByUserId[row.user_id] ?? 0)) tokensByUserId[row.user_id] = tok
            }
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

    // 3) Último recurso: leer solo id o user_id de profiles y obtener usuario por getUserById (no depende de listUsers)
    if (gestores.length === 0) {
      try {
        const ids = new Set<string>()
        const { data: onlyId } = await admin.from('profiles').select('id')
        if (onlyId && onlyId.length > 0) {
          for (const r of onlyId) {
            const v = (r as { id?: string }).id
            if (v) ids.add(v)
          }
        }
        if (ids.size === 0) {
          const { data: onlyUserId } = await admin.from('profiles').select('user_id')
          if (onlyUserId && onlyUserId.length > 0) {
            for (const r of onlyUserId) {
              const v = (r as { user_id?: string }).user_id
              if (v) ids.add(v)
            }
          }
        }
        const tokensByUid: Record<string, number> = {}
        const { data: tokRows } = await admin.from('profiles').select('id, tokens_disponibles')
        if (tokRows && tokRows.length > 0) {
          for (const r of tokRows) {
            const row = r as { id?: string; tokens_disponibles?: number }
            if (row.id) {
              const t = Math.max(0, Number(row.tokens_disponibles ?? 0))
              if (t > (tokensByUid[row.id] ?? 0)) tokensByUid[row.id] = t
            }
          }
        }
        const { data: tokUser } = await admin.from('profiles').select('user_id, tokens_disponibles')
        if (tokUser && tokUser.length > 0) {
          for (const r of tokUser) {
            const row = r as { user_id?: string; tokens_disponibles?: number }
            if (row.user_id) {
              const t = Math.max(0, Number(row.tokens_disponibles ?? 0))
              if (t > (tokensByUid[row.user_id] ?? 0)) tokensByUid[row.user_id] = t
            }
          }
        }
        for (const uid of Array.from(ids)) {
          const { data: userData } = await admin.auth.admin.getUserById(uid)
          const u = userData?.user
          if (u) {
            gestores.push({
              user_id: u.id,
              email: u.email ?? null,
              full_name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? null,
              tokens_disponibles: tokensByUid[u.id] ?? 0,
            })
          } else {
            gestores.push({
              user_id: uid,
              email: null,
              full_name: null,
              tokens_disponibles: tokensByUid[uid] ?? 0,
            })
          }
        }
      } catch (e) {
        console.error('super-admin gestores getUserById fallback:', e)
      }
    }

    // 4) Solo desde profiles: select(*) y mapear cualquier columna id/user_id, email, full_name, tokens
    if (gestores.length === 0) {
      try {
        const { data: rawRows } = await admin.from('profiles').select('*')
        if (rawRows && rawRows.length > 0) {
          const byUid = new Map<string, { user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }>()
          for (const row of rawRows) {
            const r = row as Record<string, unknown>
            const uid = (r.user_id as string) ?? (r.id as string)
            if (!uid) continue
            if (byUid.has(uid)) {
              const existing = byUid.get(uid)!
              const tok = Math.max(0, Number(r.tokens_disponibles ?? existing.tokens_disponibles ?? 0))
              if (tok > existing.tokens_disponibles) byUid.set(uid, { ...existing, tokens_disponibles: tok })
              continue
            }
            byUid.set(uid, {
              user_id: uid,
              email: (r.email as string) ?? null,
              full_name: (r.full_name as string) ?? null,
              tokens_disponibles: Math.max(0, Number(r.tokens_disponibles ?? 0)),
            })
          }
          gestores = Array.from(byUid.values())
        }
      } catch (e) {
        console.error('super-admin gestores select(*) fallback:', e)
      }
    }

    // Diagnóstico si sigue vacío: contar filas y mostrar columnas del primer registro
    let hint: string | undefined
    if (gestores.length === 0) {
      try {
        const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true })
        const { data: oneRow } = await admin.from('profiles').select('*').limit(1).maybeSingle()
        const keys = oneRow && typeof oneRow === 'object' ? Object.keys(oneRow as object) : []
        hint = count != null && count > 0
          ? `Hay ${count} fila(s) en profiles. Columnas: ${keys.join(', ') || 'ninguna'}. Se esperan id o user_id para identificar al gestor.`
          : 'No se pudo leer la tabla profiles (revisa SUPABASE_SERVICE_ROLE_KEY y que la clave sea del mismo proyecto que NEXT_PUBLIC_SUPABASE_URL).'
      } catch {
        hint = 'Error al diagnosticar la tabla profiles.'
      }
    }

    return NextResponse.json(hint ? { gestores, _hint: hint } : { gestores })
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
