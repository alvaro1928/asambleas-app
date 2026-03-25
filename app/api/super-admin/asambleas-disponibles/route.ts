import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { canAccessSuperAdminEmail } from '@/lib/super-admin'

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
    if (!(await canAccessSuperAdminEmail(supabase, session.user.email))) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data, error } = await admin
      .from('asambleas')
      .select('id, nombre, descripcion, fecha, estado, created_at, is_demo, is_archived, organization_id, organizations(name)')
      .order('fecha', { ascending: false })
      .limit(400)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const asambleas = (data || []).map((row) => {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
      return {
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion,
        fecha: row.fecha,
        estado: row.estado,
        created_at: row.created_at,
        is_demo: row.is_demo === true,
        is_archived: row.is_archived === true,
        organization_id: row.organization_id,
        organization_name: org?.name ?? 'Conjunto sin nombre',
      }
    })

    return NextResponse.json({ asambleas })
  } catch (e) {
    console.error('super-admin asambleas-disponibles GET:', e)
    return NextResponse.json({ error: 'Error al listar asambleas disponibles' }, { status: 500 })
  }
}
