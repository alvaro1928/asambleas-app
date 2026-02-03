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

    let ranking: Array<{ user_id: string; email: string | null; full_name: string | null; tokens_disponibles: number }> = []
    const { data: rankingById } = await admin
      .from('profiles')
      .select('id, email, full_name, tokens_disponibles')
      .order('tokens_disponibles', { ascending: false })
    if (rankingById && rankingById.length > 0) {
      const seen = new Set<string>()
      for (const row of rankingById) {
        const uid = (row as { id?: string }).id
        if (!uid || seen.has(uid)) continue
        seen.add(uid)
        ranking.push({
          user_id: uid,
          email: (row as { email?: string | null }).email ?? null,
          full_name: (row as { full_name?: string | null }).full_name ?? null,
          tokens_disponibles: Math.max(0, Number((row as { tokens_disponibles?: number }).tokens_disponibles ?? 0)),
        })
        if (ranking.length >= 20) break
      }
    }
    if (ranking.length === 0) {
      const { data: rankingRows } = await admin
        .from('profiles')
        .select('user_id, email, full_name, tokens_disponibles')
        .order('tokens_disponibles', { ascending: false })
      const seen = new Set<string>()
      for (const row of rankingRows ?? []) {
        const uid = (row as { user_id?: string }).user_id
        if (!uid || seen.has(uid)) continue
        seen.add(uid)
        ranking.push({
          user_id: uid,
          email: (row as { email?: string | null }).email ?? null,
          full_name: (row as { full_name?: string | null }).full_name ?? null,
          tokens_disponibles: Math.max(0, Number((row as { tokens_disponibles?: number }).tokens_disponibles ?? 0)),
        })
        if (ranking.length >= 20) break
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
