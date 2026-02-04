import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createDemoData } from '@/lib/create-demo-data'

/**
 * POST /api/dashboard/crear-asamblea-demo
 * Crea una asamblea de simulación (is_demo=true), inserta 10 unidades y 2 preguntas,
 * activa la votación pública sin descontar tokens y redirige al Centro de Control.
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
    const { organization_id: orgIdParam } = body as { organization_id?: string }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    let organizationId = orgIdParam
    if (!organizationId) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .not('organization_id', 'is', null)
        .limit(1)
      organizationId = profiles?.[0]?.organization_id ?? null
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No tienes un conjunto asociado. Crea o selecciona un conjunto primero.' },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!profile) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .eq('organization_id', organizationId)
        .maybeSingle()
      if (!byId) {
        return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
      }
    }

    const fechaHora = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const { data: asamblea, error: insertError } = await admin
      .from('asambleas')
      .insert({
        organization_id: organizationId,
        nombre: 'Asamblea de demostración',
        descripcion: 'Entorno de prueba. Los datos son simulados y no consumen créditos.',
        fecha: fechaHora,
        estado: 'borrador',
        is_demo: true,
        pago_realizado: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('crear-asamblea-demo insert:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await createDemoData(admin, asamblea.id, organizationId)

    const baseUrl = request.headers.get('origin') || request.nextUrl.origin
    const { error: rpcError } = await admin.rpc('activar_votacion_publica', {
      p_asamblea_id: asamblea.id,
      p_base_url: baseUrl,
    })
    if (rpcError) {
      console.error('crear-asamblea-demo activar_votacion_publica:', rpcError)
    }

    await admin
      .from('asambleas')
      .update({ estado: 'activa' })
      .eq('id', asamblea.id)

    return NextResponse.json({ asamblea: { ...asamblea, estado: 'activa' } })
  } catch (e) {
    console.error('crear-asamblea-demo:', e)
    return NextResponse.json({ error: 'Error al crear la asamblea de demostración' }, { status: 500 })
  }
}
