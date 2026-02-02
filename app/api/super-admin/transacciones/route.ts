import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccess(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/**
 * GET /api/super-admin/transacciones
 * Lista transacciones/pagos (pagos_log) con filtros opcionales.
 * Query: fecha_desde, fecha_hasta (YYYY-MM-DD), estado, conjunto_id, busqueda (nombre conjunto).
 * También devuelve organizaciones para el filtro por conjunto.
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fecha_desde')?.trim()
    const fechaHasta = searchParams.get('fecha_hasta')?.trim()
    const estado = searchParams.get('estado')?.trim()
    const conjuntoId = searchParams.get('conjunto_id')?.trim()
    const busqueda = searchParams.get('busqueda')?.trim()

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    let query = admin
      .from('pagos_log')
      .select('id, organization_id, monto, wompi_transaction_id, estado, created_at')
      .order('created_at', { ascending: false })

    if (fechaDesde) {
      const desde = `${fechaDesde}T00:00:00.000Z`
      query = query.gte('created_at', desde)
    }
    if (fechaHasta) {
      const hasta = `${fechaHasta}T23:59:59.999Z`
      query = query.lte('created_at', hasta)
    }
    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado)
    }
    if (conjuntoId && conjuntoId !== 'todos') {
      query = query.eq('organization_id', conjuntoId)
    }

    const { data: logs, error } = await query.limit(2000)

    if (error) {
      console.error('super-admin transacciones:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const orgNames: Record<string, string> = {}
    const allOrgIds = Array.from(new Set((logs || []).map((r) => (r as { organization_id: string }).organization_id).filter(Boolean)))
    if (allOrgIds.length > 0) {
      const { data: orgs } = await admin
        .from('organizations')
        .select('id, name')
        .in('id', allOrgIds)
      for (const o of orgs || []) {
        const row = o as { id: string; name: string }
        orgNames[row.id] = row.name ?? '—'
      }
    }

    let transaccionesList = (logs || []).map((r) => {
      const row = r as { id: string; organization_id: string; monto: number; wompi_transaction_id: string | null; estado: string; created_at: string }
      return {
        id: row.id,
        organization_id: row.organization_id,
        organization_name: orgNames[row.organization_id] ?? '—',
        monto_centavos: Number(row.monto ?? 0),
        wompi_transaction_id: row.wompi_transaction_id ?? null,
        estado: row.estado ?? 'pending',
        created_at: row.created_at,
      }
    })

    if (busqueda) {
      const { data: orgsBusqueda } = await admin
        .from('organizations')
        .select('id')
        .ilike('name', `%${busqueda}%`)
      const idsBusqueda = new Set((orgsBusqueda || []).map((o) => (o as { id: string }).id))
      transaccionesList = transaccionesList.filter((t) => idsBusqueda.has(t.organization_id))
    }

    const { data: organizacionesList } = await admin
      .from('organizations')
      .select('id, name')
      .order('name')

    const organizaciones = (organizacionesList || []).map((o) => ({
      id: (o as { id: string }).id,
      name: (o as { name: string }).name ?? '—',
    }))

    return NextResponse.json({
      transacciones: transaccionesList,
      organizaciones,
    })
  } catch (e) {
    console.error('super-admin transacciones GET:', e)
    return NextResponse.json({ error: 'Error al listar transacciones' }, { status: 500 })
  }
}
