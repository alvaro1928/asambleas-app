import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccessSuperAdmin(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/** GET: devuelve la configuración SMTP para editar en Super Admin */
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
      .from('configuracion_smtp')
      .select('id, key, host, port, secure, user, pass, from_address')
      .eq('key', 'default')
      .maybeSingle()

    if (error) {
      console.error('super-admin configuracion-smtp GET:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data as {
      id?: string
      host?: string | null
      port?: number | null
      secure?: boolean | null
      user?: string | null
      pass?: string | null
      from_address?: string | null
    } | null

    return NextResponse.json({
      id: row?.id ?? null,
      host: row?.host ?? '',
      port: row?.port != null ? Number(row.port) : 465,
      secure: row?.secure !== false,
      user: row?.user ?? '',
      pass: row?.pass ?? '',
      from_address: row?.from_address ?? '',
    })
  } catch (e) {
    console.error('super-admin configuracion-smtp GET:', e)
    return NextResponse.json({ error: 'Error al obtener configuración SMTP' }, { status: 500 })
  }
}

/** PATCH: actualiza la configuración SMTP */
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
    if (!canAccessSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { host, port, secure, user, pass, from_address } = body as {
      host?: string
      port?: number
      secure?: boolean
      user?: string
      pass?: string
      from_address?: string
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const updates: Record<string, string | number | boolean | null> = {
      updated_at: new Date().toISOString(),
    }
    if (host !== undefined) updates.host = typeof host === 'string' ? host.trim() || null : null
    if (port !== undefined) updates.port = typeof port === 'number' && port > 0 ? port : 465
    if (secure !== undefined) updates.secure = !!secure
    if (user !== undefined) updates.user = typeof user === 'string' ? user.trim() || null : null
    if (pass !== undefined) updates.pass = typeof pass === 'string' ? (pass.trim() || null) : null
    if (from_address !== undefined) updates.from_address = typeof from_address === 'string' ? from_address.trim() || null : null

    const { data: existing } = await admin
      .from('configuracion_smtp')
      .select('id')
      .eq('key', 'default')
      .maybeSingle()

    if (!existing) {
      const { error: insertErr } = await admin
        .from('configuracion_smtp')
        .insert({
          key: 'default',
          host: updates.host ?? null,
          port: updates.port ?? 465,
          secure: updates.secure ?? true,
          user: updates.user ?? null,
          pass: updates.pass ?? null,
          from_address: updates.from_address ?? null,
        })
      if (insertErr) {
        console.error('super-admin configuracion-smtp INSERT:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    const { updated_at, ...toUpdate } = updates
    const { error } = await admin
      .from('configuracion_smtp')
      .update({
        ...toUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'default')

    if (error) {
      console.error('super-admin configuracion-smtp PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('super-admin configuracion-smtp PATCH:', e)
    return NextResponse.json({ error: 'Error al guardar configuración SMTP' }, { status: 500 })
  }
}
