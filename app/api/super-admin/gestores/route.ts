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

    // 4) Solo desde profiles: select(*) y mapear id/user_id, email, full_name, tokens_disponibles
    if (gestores.length === 0) {
      try {
        const { data: rawRows, error: selectError } = await admin.from('profiles').select('*')
        if (selectError) {
          console.error('super-admin gestores select(*) error:', selectError)
        } else if (rawRows && rawRows.length > 0) {
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

    // Unificar por email: misma persona (Google + magic link) = una sola fila, un solo saldo
    const byEmail = new Map<string, { user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number; user_ids: string[] }>()
    for (const g of gestores) {
      const key = (g.email ?? '').trim().toLowerCase()
      const canonicalId = key ? key : g.user_id
      if (byEmail.has(canonicalId)) {
        const existing = byEmail.get(canonicalId)!
        const tokensMax = Math.max(existing.tokens_disponibles, g.tokens_disponibles)
        const userIds = existing.user_ids.includes(g.user_id) ? existing.user_ids : [...existing.user_ids, g.user_id]
        byEmail.set(canonicalId, {
          user_id: existing.user_id,
          email: existing.email ?? g.email,
          full_name: existing.full_name ?? g.full_name,
          tokens_disponibles: tokensMax,
          user_ids: userIds,
        })
      } else {
        byEmail.set(canonicalId, {
          user_id: g.user_id,
          email: g.email,
          full_name: g.full_name,
          tokens_disponibles: g.tokens_disponibles,
          user_ids: [g.user_id],
        })
      }
    }
    gestores = Array.from(byEmail.values()).map(({ user_ids, ...rest }) => rest)

    // Diagnóstico si sigue vacío: mostrar error real de Supabase o contar filas
    let hint: string | undefined
    if (gestores.length === 0) {
      try {
        const { count, error: countError } = await admin.from('profiles').select('*', { count: 'exact', head: true })
        const { data: oneRow, error: rowError } = await admin.from('profiles').select('*').limit(1).maybeSingle()
        const errMsg = countError?.message ?? rowError?.message
        if (errMsg) {
          hint = `Supabase devolvió: ${errMsg}. Comprueba que NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY sean del mismo proyecto donde tienes la tabla profiles.`
        } else if (count != null && count > 0) {
          const keys = oneRow && typeof oneRow === 'object' ? Object.keys(oneRow as object) : []
          hint = `Hay ${count} fila(s) en profiles. Columnas: ${keys.join(', ') || 'ninguna'}. Si no ves gestores, puede ser un problema de mapeo.`
        } else {
          hint = 'No se pudo leer la tabla profiles. Revisa que SUPABASE_SERVICE_ROLE_KEY sea del mismo proyecto que NEXT_PUBLIC_SUPABASE_URL (donde ejecutaste SELECT * FROM profiles).'
        }
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

    // Obtener email de este user_id (profiles o auth) para unificar: misma persona = una sola billetera
    let emailToMatch: string | null = null
    const { data: profRow } = await admin.from('profiles').select('email').or(`user_id.eq.${user_id},id.eq.${user_id}`).limit(1).maybeSingle()
    const prof = profRow as { email?: string | null } | null
    if (prof?.email && String(prof.email).trim()) emailToMatch = String(prof.email).trim().toLowerCase()
    if (!emailToMatch) {
      try {
        const { data: userData } = await admin.auth.admin.getUserById(user_id)
        if (userData?.user?.email) emailToMatch = userData.user.email.trim().toLowerCase()
      } catch {
        // ignorar
      }
    }

    const userIdsToUpdate: string[] = [user_id]
    if (emailToMatch) {
      const { data: profilesWithEmail } = await admin.from('profiles').select('user_id, id, email')
      const withEmail = (profilesWithEmail ?? []) as Array<{ user_id?: string | null; id?: string | null; email?: string | null }>
      for (const r of withEmail) {
        const e = (r.email ?? '').trim().toLowerCase()
        if (e === emailToMatch) {
          const uid = r.user_id ?? r.id
          if (uid && !userIdsToUpdate.includes(uid)) userIdsToUpdate.push(uid)
        }
      }
      if (userIdsToUpdate.length === 1) {
        try {
          const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
          const users = usersData?.users ?? []
          for (const u of users) {
            if (u.email && u.email.trim().toLowerCase() === emailToMatch && !userIdsToUpdate.includes(u.id)) {
              userIdsToUpdate.push(u.id)
            }
          }
        } catch {
          // ignorar
        }
      }
    }

    // Actualizar todas las filas de profiles para este user_id y para cualquier otro user_id con el mismo email
    let lastError: Error | null = null
    for (const uid of userIdsToUpdate) {
      const { error: errUser } = await admin.from('profiles').update({ tokens_disponibles: value }).eq('user_id', uid)
      const { error: errId } = await admin.from('profiles').update({ tokens_disponibles: value }).eq('id', uid)
      if (errUser) lastError = errUser
      if (errId) lastError = errId
    }

    if (lastError) {
      console.error('super-admin gestores PATCH:', lastError)
      return NextResponse.json({ error: lastError.message || 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('super-admin gestores PATCH:', e)
    return NextResponse.json({ error: 'Error al actualizar tokens del gestor' }, { status: 500 })
  }
}
