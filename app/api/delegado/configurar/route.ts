import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

/**
 * POST /api/delegado/configurar  → genera un nuevo token_delegado
 * DELETE /api/delegado/configurar → revoca el token (lo pone en NULL)
 *
 * Solo el administrador autenticado de la asamblea puede usar estos endpoints.
 * Body: { asamblea_id: string }
 */

async function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Configuración interna incompleta')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } })
}

async function getSession(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
  return supabase.auth.getSession()
}

async function verificarPermiso(adminClient: ReturnType<typeof createClient>, userId: string, asambleaId: string) {
  const [{ data: profile }, { data: asamblea }] = await Promise.all([
    adminClient.from('profiles').select('organization_id').eq('id', userId).single(),
    adminClient.from('asambleas').select('id, organization_id').eq('id', asambleaId).single(),
  ])
  if (!asamblea) return { error: 'Asamblea no encontrada', status: 404 }
  if (profile?.organization_id && asamblea.organization_id !== profile.organization_id) {
    return { error: 'Sin permiso para esta asamblea', status: 403 }
  }
  return { ok: true, asamblea }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { session } } = await getSession(cookieStore)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { asamblea_id } = await request.json().catch(() => ({})) as { asamblea_id?: string }
    if (!asamblea_id) return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })

    const admin = await getAdminClient()
    const perm = await verificarPermiso(admin, session.user.id, asamblea_id)
    if (perm.error) return NextResponse.json({ error: perm.error }, { status: perm.status })

    const token = randomUUID()
    await admin.from('asambleas').update({ token_delegado: token }).eq('id', asamblea_id)

    return NextResponse.json({ ok: true, token })
  } catch (e) {
    console.error('delegado/configurar POST:', e)
    return NextResponse.json({ error: 'Error al generar token' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const { data: { session } } = await getSession(cookieStore)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { asamblea_id } = await request.json().catch(() => ({})) as { asamblea_id?: string }
    if (!asamblea_id) return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })

    const admin = await getAdminClient()
    const perm = await verificarPermiso(admin, session.user.id, asamblea_id)
    if (perm.error) return NextResponse.json({ error: perm.error }, { status: perm.status })

    await admin.from('asambleas').update({ token_delegado: null }).eq('id', asamblea_id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('delegado/configurar DELETE:', e)
    return NextResponse.json({ error: 'Error al revocar token' }, { status: 500 })
  }
}
