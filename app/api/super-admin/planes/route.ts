import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccessSuperAdmin(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/** GET: lista todos los planes (solo super admin) */
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
    if (!canAccessSuperAdmin(session.user.email)) {
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

    const { data, error } = await admin
      .from('planes')
      .select('id, key, nombre, precio_cop_anual, activo, max_preguntas_por_asamblea, incluye_acta_detallada')
      .order('precio_cop_anual', { ascending: true })

    if (error) {
      console.error('super-admin planes GET:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ planes: data ?? [] })
  } catch (e) {
    console.error('super-admin planes GET:', e)
    return NextResponse.json({ error: 'Error al listar planes' }, { status: 500 })
  }
}

/** PATCH: actualizar nombre o precio de un plan (solo super admin) */
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
    if (!canAccessSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { id, key, nombre, precio_cop_anual, max_preguntas_por_asamblea, incluye_acta_detallada } = body as {
      id?: string
      key?: string
      nombre?: string
      precio_cop_anual?: number
      max_preguntas_por_asamblea?: number
      incluye_acta_detallada?: boolean
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

    const updates: {
      nombre?: string
      precio_cop_anual?: number
      max_preguntas_por_asamblea?: number
      incluye_acta_detallada?: boolean
    } = {}
    if (typeof nombre === 'string' && nombre.trim()) updates.nombre = nombre.trim()
    if (typeof precio_cop_anual === 'number' && precio_cop_anual >= 0) updates.precio_cop_anual = precio_cop_anual
    if (typeof max_preguntas_por_asamblea === 'number' && max_preguntas_por_asamblea >= 0) updates.max_preguntas_por_asamblea = max_preguntas_por_asamblea
    if (typeof incluye_acta_detallada === 'boolean') updates.incluye_acta_detallada = incluye_acta_detallada

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Falta al menos un campo: nombre, precio_cop_anual, max_preguntas_por_asamblea o incluye_acta_detallada' }, { status: 400 })
    }

    let query = admin.from('planes').update(updates)
    if (id) {
      query = query.eq('id', id)
    } else if (key) {
      query = query.eq('key', key)
    } else {
      return NextResponse.json({ error: 'Falta id o key del plan' }, { status: 400 })
    }

    const { error } = await query

    if (error) {
      console.error('super-admin planes PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('super-admin planes PATCH:', e)
    return NextResponse.json({ error: 'Error al actualizar plan' }, { status: 500 })
  }
}
