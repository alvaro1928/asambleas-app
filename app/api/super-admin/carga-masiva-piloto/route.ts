import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccessSuperAdmin(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/**
 * POST: carga masiva de cuentas piloto.
 * Body: FormData con file (CSV). CSV debe tener columna "organization_id" o "nombre" (nombre del conjunto).
 * Por cada fila: asigna plan pilot, vigencia 3 meses, tokens del plan pilot.
 */
export async function POST(request: NextRequest) {
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
    if (!canAccessSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo CSV (campo "file")' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length < 2) {
      return NextResponse.json({ error: 'El CSV debe tener al menos cabecera y una fila' }, { status: 400 })
    }

    const header = lines[0].toLowerCase()
    const hasId = header.includes('organization_id') || header.includes('id')
    const hasNombre = header.includes('nombre') || header.includes('name')
    const colId = header.split(',').findIndex((c) => /organization_id|id/.test(c.trim()))
    const colNombre = header.split(',').findIndex((c) => /nombre|name/.test(c.trim()))

    if (colId < 0 && colNombre < 0) {
      return NextResponse.json({
        error: 'El CSV debe tener columna "organization_id" o "nombre" (nombre del conjunto)',
      }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: planPilot } = await admin
      .from('planes')
      .select('tokens_iniciales, vigencia_meses')
      .eq('key', 'pilot')
      .maybeSingle()
    const tokensPilot = planPilot != null && typeof (planPilot as { tokens_iniciales?: number }).tokens_iniciales === 'number'
      ? Math.max(0, (planPilot as { tokens_iniciales: number }).tokens_iniciales)
      : 10
    const vigenciaMeses = planPilot != null && typeof (planPilot as { vigencia_meses?: number | null }).vigencia_meses === 'number'
      ? Math.max(0, (planPilot as { vigencia_meses: number }).vigencia_meses)
      : 3

    const now = new Date()
    const activeUntil = new Date(now)
    activeUntil.setMonth(activeUntil.getMonth() + vigenciaMeses)

    const resultados: { fila: number; id?: string; nombre?: string; ok: boolean; error?: string }[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const idRaw = colId >= 0 ? cols[colId] : undefined
      const nombreRaw = colNombre >= 0 ? cols[colNombre] : undefined

      if (!idRaw && !nombreRaw) {
        resultados.push({ fila: i + 1, ok: false, error: 'Fila sin id ni nombre' })
        continue
      }

      let orgId: string | null = null
      if (idRaw && idRaw.length > 10) {
        const { data: byId } = await admin
          .from('organizations')
          .select('id')
          .eq('id', idRaw)
          .maybeSingle()
        if (byId) orgId = (byId as { id: string }).id
      }
      if (!orgId && nombreRaw) {
        const { data: byNameList } = await admin
          .from('organizations')
          .select('id')
          .ilike('name', nombreRaw)
          .limit(1)
        const byName = Array.isArray(byNameList) && byNameList.length > 0 ? byNameList[0] : null
        if (byName) orgId = (byName as { id: string }).id
      }

      if (!orgId) {
        resultados.push({ fila: i + 1, nombre: nombreRaw || idRaw, ok: false, error: 'Conjunto no encontrado' })
        continue
      }

      const { error } = await admin
        .from('organizations')
        .update({
          plan_type: 'pilot',
          subscription_status: 'active',
          plan_active_until: activeUntil.toISOString(),
          tokens_disponibles: tokensPilot,
        })
        .eq('id', orgId)

      if (error) {
        resultados.push({ fila: i + 1, id: orgId, ok: false, error: error.message })
      } else {
        resultados.push({ fila: i + 1, id: orgId, ok: true })
      }
    }

    const ok = resultados.filter((r) => r.ok).length
    const fail = resultados.filter((r) => !r.ok).length
    return NextResponse.json({
      ok: true,
      total: resultados.length,
      exitosos: ok,
      fallidos: fail,
      resultados,
    })
  } catch (e) {
    console.error('carga-masiva-piloto:', e)
    return NextResponse.json({ error: 'Error en carga masiva' }, { status: 500 })
  }
}
