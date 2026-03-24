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

    const unidadIdsFromMeta = new Set<string>()
    for (const r of rows) {
      const m = r.metadata as { unidad_ids?: unknown } | null
      const arr = m?.unidad_ids
      if (Array.isArray(arr)) {
        for (const u of arr) {
          if (typeof u === 'string') unidadIdsFromMeta.add(u)
        }
      }
    }
    let unidadEtiquetas: Record<string, string> = {}
    if (unidadIdsFromMeta.size > 0) {
      const { data: unidadesRows } = await admin
        .from('unidades')
        .select('id, torre, numero')
        .in('id', Array.from(unidadIdsFromMeta))
      for (const u of unidadesRows ?? []) {
        const row = u as { id: string; torre?: string | null; numero?: string | null }
        const t = (row.torre ?? '').trim()
        const n = (row.numero ?? '').trim()
        unidadEtiquetas[row.id] = [t, n].filter(Boolean).join(' ') || row.id.slice(0, 8)
      }
    }

    const uso = rows.map((r) => {
      const meta = (r.metadata ?? null) as Record<string, unknown> | null
      let unidad_labels: string[] | undefined
      if (meta && Array.isArray(meta.unidad_ids)) {
        unidad_labels = (meta.unidad_ids as string[])
          .map((id) => unidadEtiquetas[id] ?? id.slice(0, 8))
          .filter(Boolean)
      }
      return {
        id: r.id,
        fecha: r.fecha,
        tipo_operacion: r.tipo_operacion,
        tokens_usados: Number(r.tokens_usados ?? 0),
        saldo_restante: Number(r.saldo_restante ?? 0),
        asamblea_nombre: r.asamblea_id ? (asambleaNombre[r.asamblea_id] ?? '—') : null,
        conjunto_nombre: r.organization_id ? (orgNombre[r.organization_id] ?? '—') : null,
        metadata: meta,
        unidad_labels: unidad_labels?.length ? unidad_labels : undefined,
      }
    })

    return NextResponse.json({ uso })
  } catch (e) {
    console.error('GET /api/dashboard/uso-tokens:', e)
    return NextResponse.json({ error: 'Error al cargar el uso de tokens' }, { status: 500 })
  }
}
