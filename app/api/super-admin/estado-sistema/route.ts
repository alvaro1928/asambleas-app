import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

function canAccess(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/**
 * GET /api/super-admin/estado-sistema
 * Estado del sistema: tokens vendidos, tokens regalados (estimado), ranking de gestores por saldo.
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
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const tokensPorPago = 1

    const { count: countVendidos, error: errVendidos } = await admin
      .from('pagos_log')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'APPROVED')

    const tokensVendidos = errVendidos ? 0 : (countVendidos ?? 0) * tokensPorPago

    const { data: configRow } = await admin
      .from('configuracion_global')
      .select('bono_bienvenida_tokens')
      .eq('key', 'landing')
      .maybeSingle()

    const bonoBienvenida = configRow?.bono_bienvenida_tokens != null ? Number(configRow.bono_bienvenida_tokens) : 50

    let userIds = new Set<string>()
    const { data: perfilesUser } = await admin.from('profiles').select('user_id')
    if (perfilesUser && perfilesUser.length > 0) {
      const ids = (perfilesUser as { user_id?: string }[]).map((p) => p.user_id).filter((x): x is string => Boolean(x))
      userIds = new Set(ids)
    }
    if (userIds.size === 0) {
      const { data: perfilesId } = await admin.from('profiles').select('id')
      if (perfilesId && perfilesId.length > 0) {
        const ids = (perfilesId as { id?: string }[]).map((p) => p.id).filter((x): x is string => Boolean(x))
        userIds = new Set(ids)
      }
    }
    const tokensRegaladosEstimado = bonoBienvenida * userIds.size

    // Ranking: una fila por usuario (dedupe por user_id o id). Consolidar tokens = max de todas sus filas en profiles.
    type ProfileRow = { id?: string; user_id?: string; email?: string | null; full_name?: string | null; tokens_disponibles?: number }
    let ranking: Array<{ user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }> = []
    const { data: allRows } = await admin
      .from('profiles')
      .select('id, user_id, email, full_name, tokens_disponibles')
    if (allRows && allRows.length > 0) {
      const byUser = new Map<string, { email: string | null; full_name: string | null; tokens: number }>()
      for (const row of allRows as ProfileRow[]) {
        const uid = row.user_id ?? row.id
        if (!uid) continue
        const tokens = Math.max(0, Number(row.tokens_disponibles ?? 0))
        const existing = byUser.get(uid)
        if (!existing) {
          byUser.set(uid, {
            email: row.email ?? null,
            full_name: row.full_name ?? null,
            tokens,
          })
        } else {
          existing.tokens = Math.max(existing.tokens, tokens)
          if (!existing.email && row.email) existing.email = row.email
          if (!existing.full_name && row.full_name) existing.full_name = row.full_name
        }
      }
      ranking = Array.from(byUser.entries())
        .map(([user_id, v]) => ({ user_id, email: v.email, full_name: v.full_name, tokens_disponibles: v.tokens }))
        .sort((a, b) => b.tokens_disponibles - a.tokens_disponibles)
        .slice(0, 20)

      // Si en el ranking falta email/nombre, completar desde Auth (evita mostrar UUID)
      for (const r of ranking) {
        if ((!r.email || !r.full_name) && r.user_id) {
          try {
            const { data: authUser } = await admin.auth.admin.getUserById(r.user_id)
            const authEmail = authUser?.user?.email ?? null
            const authName = authUser?.user?.user_metadata?.full_name ?? authUser?.user?.user_metadata?.name ?? null
            if (authEmail) r.email = authEmail
            if (authName) r.full_name = authName
          } catch {
            // ignorar; mantener email/full_name actual
          }
        }
      }
    }

    return NextResponse.json({
      tokens_vendidos: tokensVendidos,
      tokens_regalados_estimado: tokensRegaladosEstimado,
      bono_bienvenida: bonoBienvenida,
      total_gestores: userIds.size,
      ranking_gestores: ranking,
    })
  } catch (e) {
    console.error('estado-sistema GET:', e)
    return NextResponse.json({ error: 'Error al obtener estado del sistema' }, { status: 500 })
  }
}
