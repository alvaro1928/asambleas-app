import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/uso-tokens
 * Lista el historial de uso de tokens del usuario (billing_logs) con fecha y hora.
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: logs, error } = await admin
      .from('billing_logs')
      .select('id, fecha, tipo_operacion, tokens_usados, saldo_restante, asamblea_id, organization_id, metadata')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .limit(300)

    if (error) {
      console.error('uso-tokens GET:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (logs ?? []) as Array<{
      id: string
      fecha: string
      tipo_operacion: string
      tokens_usados: number
      saldo_restante: number
      asamblea_id?: string | null
      organization_id?: string | null
      metadata?: Record<string, unknown> | null
    }>

    const asambleaIds = Array.from(new Set(rows.map((r) => r.asamblea_id).filter(Boolean))) as string[]
    const orgIds = Array.from(new Set(rows.map((r) => r.organization_id).filter(Boolean))) as string[]

    let asambleas: { id: string; nombre: string }[] = []
    let orgs: { id: string; name: string }[] = []
    if (asambleaIds.length > 0) {
      const resA = await admin.from('asambleas').select('id, nombre').in('id', asambleaIds)
      asambleas = (resA.data ?? []) as { id: string; nombre: string }[]
    }
    if (orgIds.length > 0) {
      const resO = await admin.from('organizations').select('id, name').in('id', orgIds)
      orgs = (resO.data ?? []) as { id: string; name: string }[]
    }

    const asambleaNombre: Record<string, string> = {}
    for (const a of asambleas) asambleaNombre[a.id] = a.nombre ?? '—'
    const orgNombre: Record<string, string> = {}
    for (const o of orgs) orgNombre[o.id] = o.name ?? '—'

    const uso = rows.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      tipo_operacion: r.tipo_operacion,
      tokens_usados: Number(r.tokens_usados ?? 0),
      saldo_restante: Number(r.saldo_restante ?? 0),
      asamblea_nombre: r.asamblea_id ? (asambleaNombre[r.asamblea_id] ?? '—') : null,
      conjunto_nombre: r.organization_id ? (orgNombre[r.organization_id] ?? '—') : null,
      metadata: r.metadata ?? null,
    }))

    return NextResponse.json({ uso })
  } catch (e) {
    console.error('GET /api/dashboard/uso-tokens:', e)
    return NextResponse.json({ error: 'Error al cargar el uso de tokens' }, { status: 500 })
  }
}
