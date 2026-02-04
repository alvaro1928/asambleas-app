import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/mis-pagos
 * Lista las transacciones de pago (pagos_log) del usuario actual:
 * - Por organización (conjuntos donde tiene perfil) y/o por user_id (pagos acreditados sin conjunto).
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Organizaciones del usuario: perfiles donde user_id = userId o id = userId
    const { data: byUserId } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', userId)
      .not('organization_id', 'is', null)
    const { data: byId } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .not('organization_id', 'is', null)

    const idsByUser = (Array.isArray(byUserId) ? byUserId : byUserId ? [byUserId] : [])
      .map((r: { organization_id: string }) => r.organization_id)
      .filter(Boolean)
    const idsById = (Array.isArray(byId) ? byId : byId ? [byId] : [])
      .map((r: { organization_id: string }) => r.organization_id)
      .filter(Boolean)
    const allOrgIds = Array.from(new Set([...idsByUser, ...idsById]))

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    type LogRow = { id: string; organization_id: string | null; monto: number; wompi_transaction_id: string | null; estado: string; created_at: string }
    const seenIds = new Set<string>()
    const allLogs: LogRow[] = []

    // 1) Pagos por conjuntos del usuario
    if (allOrgIds.length > 0) {
      const { data: logsByOrg, error: errOrg } = await admin
        .from('pagos_log')
        .select('id, organization_id, monto, wompi_transaction_id, estado, created_at')
        .in('organization_id', allOrgIds)
        .order('created_at', { ascending: false })
        .limit(500)
      if (!errOrg && logsByOrg?.length) {
        for (const r of logsByOrg as LogRow[]) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id)
            allLogs.push(r)
          }
        }
      }
    }

    // 2) Pagos registrados con user_id (incl. sin organización) para este usuario
    const { data: logsByUser, error: errUser } = await admin
      .from('pagos_log')
      .select('id, organization_id, monto, wompi_transaction_id, estado, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (!errUser && logsByUser?.length) {
      for (const r of logsByUser as LogRow[]) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id)
          allLogs.push(r)
        }
      }
    }

    const sorted = allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 500)

    const orgIdsInLogs = Array.from(new Set(sorted.map((r) => r.organization_id).filter(Boolean))) as string[]
    let orgs: { id: string; name: string }[] | null = null
    if (orgIdsInLogs.length > 0) {
      const res = await admin.from('organizations').select('id, name').in('id', orgIdsInLogs)
      orgs = res.data
    }

    const orgNames: Record<string, string> = {}
    for (const o of orgs || []) {
      const row = o as { id: string; name: string }
      orgNames[row.id] = row.name ?? '—'
    }

    const pagos = sorted.map(
      (r: LogRow) => ({
        id: r.id,
        organization_id: r.organization_id,
        organization_name: r.organization_id ? (orgNames[r.organization_id] ?? '—') : '—',
        monto_centavos: Number(r.monto ?? 0),
        wompi_transaction_id: r.wompi_transaction_id ?? null,
        estado: r.estado ?? 'pending',
        created_at: r.created_at,
      })
    )

    return NextResponse.json({
      pagos,
      organizaciones: allOrgIds.map((id) => ({
        id,
        name: orgNames[id] ?? id,
      })),
    })
  } catch (e) {
    console.error('GET /api/dashboard/mis-pagos:', e)
    return NextResponse.json(
      { error: 'Error al cargar tus pagos' },
      { status: 500 }
    )
  }
}
