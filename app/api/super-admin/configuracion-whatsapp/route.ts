import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccess(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/** GET: configuración WhatsApp para Super Admin */
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

    const { data, error } = await admin
      .from('configuracion_whatsapp')
      .select('id, access_token, phone_number_id, template_name, tokens_por_mensaje_whatsapp, habilitado')
      .eq('key', 'default')
      .maybeSingle()

    if (error) {
      console.error('configuracion-whatsapp GET:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data as {
      access_token?: string | null
      phone_number_id?: string | null
      template_name?: string | null
      tokens_por_mensaje_whatsapp?: number | null
      habilitado?: boolean | null
    } | null

    return NextResponse.json({
      access_token: row?.access_token ?? '',
      phone_number_id: row?.phone_number_id ?? '',
      template_name: row?.template_name ?? '',
      tokens_por_mensaje_whatsapp: row?.tokens_por_mensaje_whatsapp != null ? Number(row.tokens_por_mensaje_whatsapp) : 1,
      habilitado: row?.habilitado !== false,
    })
  } catch (e) {
    console.error('configuracion-whatsapp GET:', e)
    return NextResponse.json({ error: 'Error al obtener configuración WhatsApp' }, { status: 500 })
  }
}

/** PATCH: actualizar configuración WhatsApp */
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

    const { data: { session } } = await supabase.auth.getSession()
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

    const body = await request.json().catch(() => ({}))
    const {
      access_token,
      phone_number_id,
      template_name,
      tokens_por_mensaje_whatsapp,
      habilitado,
    } = body as {
      access_token?: string
      phone_number_id?: string
      template_name?: string
      tokens_por_mensaje_whatsapp?: number
      habilitado?: boolean
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const updates: Record<string, string | number | boolean | null> = {
      updated_at: new Date().toISOString(),
    }
    if (access_token !== undefined) updates.access_token = typeof access_token === 'string' ? access_token.trim() || null : null
    if (phone_number_id !== undefined) updates.phone_number_id = typeof phone_number_id === 'string' ? phone_number_id.trim() || null : null
    if (template_name !== undefined) updates.template_name = typeof template_name === 'string' ? template_name.trim() || null : null
    if (tokens_por_mensaje_whatsapp !== undefined) {
      const n = Math.max(1, Math.floor(Number(tokens_por_mensaje_whatsapp)))
      updates.tokens_por_mensaje_whatsapp = n
    }
    if (habilitado !== undefined) updates.habilitado = !!habilitado

    const { data: existing } = await admin
      .from('configuracion_whatsapp')
      .select('id')
      .eq('key', 'default')
      .maybeSingle()

    if (!existing) {
      await admin.from('configuracion_whatsapp').insert({
        key: 'default',
        access_token: updates.access_token ?? null,
        phone_number_id: updates.phone_number_id ?? null,
        template_name: updates.template_name ?? null,
        tokens_por_mensaje_whatsapp: updates.tokens_por_mensaje_whatsapp ?? 1,
        habilitado: updates.habilitado !== false,
      })
      return NextResponse.json({ ok: true })
    }

    const { updated_at, ...toUpdate } = updates
    const { error } = await admin
      .from('configuracion_whatsapp')
      .update({
        ...toUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'default')

    if (error) {
      console.error('configuracion-whatsapp PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('configuracion-whatsapp PATCH:', e)
    return NextResponse.json({ error: 'Error al guardar configuración WhatsApp' }, { status: 500 })
  }
}
