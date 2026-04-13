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

    interface UsoTokenRow {
      id: string
      fecha: string
      tipo_operacion: string
      tokens_usados: number
      saldo_restante: number
      asamblea_nombre: string | null
      conjunto_nombre: string | null
      metadata: Record<string, unknown> | null
      unidad_labels?: string[]
    }

    interface ConsentGroup {
      id: string
      fecha: string
      tipo_operacion: 'Consentimiento_sesion'
      tokens_usados: number
      saldo_restante: number
      asamblea_id: string | null
      organization_id: string | null
      session_seq: number
      unidad_ids: Set<string>
    }

    const parseSessionSeq = (meta: Record<string, unknown> | null): number | null => {
      const raw = meta?.session_seq
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
      if (typeof raw === 'string') {
        const parsed = Number(raw)
        if (Number.isFinite(parsed)) return Math.trunc(parsed)
      }
      return null
    }

    const groupedConsent = new Map<string, ConsentGroup>()
    const passthroughRows: UsoTokenRow[] = []

    for (const r of rows) {
      const meta = (r.metadata ?? null) as Record<string, unknown> | null

      if (r.tipo_operacion !== 'Consentimiento_sesion') {
        let unidad_labels: string[] | undefined
        if (meta && Array.isArray(meta.unidad_ids)) {
          unidad_labels = (meta.unidad_ids as string[])
            .map((id) => unidadEtiquetas[id] ?? id.slice(0, 8))
            .filter(Boolean)
        }
        passthroughRows.push({
          id: r.id,
          fecha: r.fecha,
          tipo_operacion: r.tipo_operacion,
          tokens_usados: Number(r.tokens_usados ?? 0),
          saldo_restante: Number(r.saldo_restante ?? 0),
          asamblea_nombre: r.asamblea_id ? (asambleaNombre[r.asamblea_id] ?? '—') : null,
          conjunto_nombre: r.organization_id ? (orgNombre[r.organization_id] ?? '—') : null,
          metadata: meta,
          unidad_labels: unidad_labels?.length ? unidad_labels : undefined,
        })
        continue
      }

      const sessionSeq = parseSessionSeq(meta)
      if (!r.asamblea_id || sessionSeq == null) {
        passthroughRows.push({
          id: r.id,
          fecha: r.fecha,
          tipo_operacion: r.tipo_operacion,
          tokens_usados: Number(r.tokens_usados ?? 0),
          saldo_restante: Number(r.saldo_restante ?? 0),
          asamblea_nombre: r.asamblea_id ? (asambleaNombre[r.asamblea_id] ?? '—') : null,
          conjunto_nombre: r.organization_id ? (orgNombre[r.organization_id] ?? '—') : null,
          metadata: meta,
        })
        continue
      }

      const groupKey = `${r.asamblea_id}::${sessionSeq}`
      const ids = Array.isArray(meta?.unidad_ids) ? (meta!.unidad_ids as string[]).filter((id) => typeof id === 'string') : []

      const current = groupedConsent.get(groupKey)
      if (!current) {
        groupedConsent.set(groupKey, {
          id: `consent:${groupKey}`,
          fecha: r.fecha,
          tipo_operacion: 'Consentimiento_sesion',
          tokens_usados: Number(r.tokens_usados ?? 0),
          saldo_restante: Number(r.saldo_restante ?? 0),
          asamblea_id: r.asamblea_id ?? null,
          organization_id: r.organization_id ?? null,
          session_seq: sessionSeq,
          unidad_ids: new Set(ids),
        })
      } else {
        current.tokens_usados += Number(r.tokens_usados ?? 0)
        for (const id of ids) current.unidad_ids.add(id)
        if (new Date(r.fecha).getTime() > new Date(current.fecha).getTime()) {
          current.fecha = r.fecha
          current.saldo_restante = Number(r.saldo_restante ?? 0)
          current.id = `consent:${groupKey}:${r.id}`
        }
      }
    }

    const consentRows: UsoTokenRow[] = Array.from(groupedConsent.values()).map((g) => {
      const unidadIds = Array.from(g.unidad_ids)
      return {
        id: g.id,
        fecha: g.fecha,
        tipo_operacion: g.tipo_operacion,
        tokens_usados: g.tokens_usados,
        saldo_restante: g.saldo_restante,
        asamblea_nombre: g.asamblea_id ? (asambleaNombre[g.asamblea_id] ?? '—') : null,
        conjunto_nombre: g.organization_id ? (orgNombre[g.organization_id] ?? '—') : null,
        metadata: {
          session_seq: g.session_seq,
          unidad_ids: unidadIds,
          operaciones_agrupadas: true,
        },
        unidad_labels: unidadIds.map((id) => unidadEtiquetas[id] ?? id.slice(0, 8)).filter(Boolean),
      }
    })

    const uso = [...passthroughRows, ...consentRows].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )

    return NextResponse.json({ uso })
  } catch (e) {
    console.error('GET /api/dashboard/uso-tokens:', e)
    return NextResponse.json({ error: 'Error al cargar el uso de tokens' }, { status: 500 })
  }
}
