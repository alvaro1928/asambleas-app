import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Normaliza el identificador como en GET /api/votar/consentimiento (email en minúsculas).
 * Para teléfonos también se incluye solo dígitos (por si el usuario guardó de otra forma).
 */
function variantesIdentificadorManual(raw: string): string[] {
  const t = raw.trim().toLowerCase()
  if (!t) return []
  const out = new Set<string>()
  out.add(t)
  const digits = t.replace(/\D/g, '')
  if (digits.length >= 6) out.add(digits)
  return [...out]
}

function identificadoresDesdeUnidad(u: {
  email_propietario?: string | null
  email?: string | null
  telefono_propietario?: string | null
  telefono?: string | null
}): string[] {
  const out = new Set<string>()
  const addEmail = (raw: string | null | undefined) => {
    if (!raw) return
    for (const part of raw.split(/[;,]/)) {
      const x = part.trim().toLowerCase()
      if (x) out.add(x)
    }
  }
  addEmail(u.email_propietario)
  addEmail(u.email)
  const addPhone = (raw: string | null | undefined) => {
    if (!raw) return
    const digits = String(raw).replace(/\D/g, '')
    if (digits.length >= 6) out.add(digits)
    const low = String(raw).trim().toLowerCase()
    if (low) out.add(low)
  }
  addPhone(u.telefono_propietario)
  addPhone(u.telefono)
  return [...out]
}

async function usuarioTieneAccesoConjunto(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (profile) return true
  const { data: byId } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  return !!byId
}

/**
 * POST /api/dashboard/reset-consentimiento
 * Elimina registros de consentimiento de tratamiento de datos (LOPD) para que el votante
 * deba aceptar de nuevo al entrar.
 *
 * Body:
 * - asamblea_id: UUID (requerido; define el conjunto vía organization_id)
 * - tipo: 'identificador' | 'unidad'
 * - alcance: 'esta_asamblea' | 'todo_el_conjunto'
 * - identificador?: string (si tipo identificador: email/tel como lo escribe el votante)
 * - unidad_id?: UUID (si tipo unidad)
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      asamblea_id,
      tipo,
      alcance,
      identificador,
      unidad_id,
    } = body as {
      asamblea_id?: string
      tipo?: 'identificador' | 'unidad'
      alcance?: 'esta_asamblea' | 'todo_el_conjunto'
      identificador?: string
      unidad_id?: string
    }

    if (!asamblea_id || !tipo || !alcance) {
      return NextResponse.json(
        { error: 'Faltan asamblea_id, tipo o alcance' },
        { status: 400 }
      )
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: asambleaRow, error: asambleaErr } = await admin
      .from('asambleas')
      .select('id, organization_id')
      .eq('id', asamblea_id)
      .maybeSingle()

    if (asambleaErr || !asambleaRow?.organization_id) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asambleaRow.organization_id as string

    const ok = await usuarioTieneAccesoConjunto(supabase, session.user.id, orgId)
    if (!ok) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    let identificadores: string[] = []

    if (tipo === 'identificador') {
      const raw = typeof identificador === 'string' ? identificador : ''
      if (!raw.trim()) {
        return NextResponse.json({ error: 'Indica el email o teléfono del votante' }, { status: 400 })
      }
      identificadores = variantesIdentificadorManual(raw)
    } else if (tipo === 'unidad') {
      if (!unidad_id || typeof unidad_id !== 'string') {
        return NextResponse.json({ error: 'Indica la unidad' }, { status: 400 })
      }
      const { data: unidad, error: uErr } = await admin
        .from('unidades')
        .select('id, organization_id, email_propietario, email, telefono_propietario, telefono')
        .eq('id', unidad_id)
        .maybeSingle()

      if (uErr || !unidad) {
        return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 })
      }
      if ((unidad as { organization_id: string }).organization_id !== orgId) {
        return NextResponse.json({ error: 'La unidad no pertenece a este conjunto' }, { status: 403 })
      }
      identificadores = identificadoresDesdeUnidad(unidad as Record<string, string | null>)
      if (identificadores.length === 0) {
        return NextResponse.json(
          { error: 'Esta unidad no tiene email ni teléfono registrados; usa reset por identificador manual.' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }

    let query = admin.from('consentimiento_tratamiento_datos').delete()

    if (alcance === 'esta_asamblea') {
      query = query.eq('asamblea_id', asamblea_id).in('identificador', identificadores)
    } else if (alcance === 'todo_el_conjunto') {
      const { data: asambleasOrg, error: aErr } = await admin
        .from('asambleas')
        .select('id')
        .eq('organization_id', orgId)
      if (aErr) {
        return NextResponse.json({ error: aErr.message }, { status: 500 })
      }
      const idsAsm = (asambleasOrg || []).map((a) => a.id)
      if (idsAsm.length === 0) {
        return NextResponse.json({ ok: true, deleted: 0 })
      }
      query = query.in('asamblea_id', idsAsm).in('identificador', identificadores)
    } else {
      return NextResponse.json({ error: 'alcance inválido' }, { status: 400 })
    }

    const { data: deletedRows, error: delErr } = await query.select('id')

    if (delErr) {
      console.error('reset-consentimiento delete:', delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    const deleted = Array.isArray(deletedRows) ? deletedRows.length : 0

    return NextResponse.json({
      ok: true,
      deleted,
      identificadores_afectados: identificadores,
      alcance,
    })
  } catch (e) {
    console.error('POST /api/dashboard/reset-consentimiento:', e)
    return NextResponse.json({ error: 'Error al resetear consentimiento' }, { status: 500 })
  }
}
