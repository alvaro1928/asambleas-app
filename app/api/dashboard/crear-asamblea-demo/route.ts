import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createDemoData } from '@/lib/create-demo-data'

/**
 * POST /api/dashboard/crear-asamblea-demo
 * Crea una asamblea de simulación (is_demo=true), inserta 10 unidades y 0 preguntas por defecto,
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

    // Si ya existe una asamblea demo en este conjunto, devolverla para redirigir
    const { data: existingDemo } = await admin
      .from('asambleas')
      .select('id, nombre, estado, is_demo, pago_realizado, activated_at')
      .eq('organization_id', organizationId)
      .eq('is_demo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingDemo) {
      // Asegurar que la demo quede editable en el panel (ventana de gracia basada en activated_at)
      const nowIso = new Date().toISOString()
      if (!existingDemo.activated_at || existingDemo.estado !== 'activa') {
        await admin
          .from('asambleas')
          .update({ estado: 'activa', activated_at: nowIso })
          .eq('id', existingDemo.id)
      }
      return NextResponse.json({ asamblea: existingDemo })
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
        sandbox_usar_unidades_reales: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('crear-asamblea-demo insert:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Sandbox: crear datos demo debe ser tolerante a reintentos.
    try {
      await createDemoData(admin, asamblea.id, organizationId)
    } catch (demoErr) {
      // No bloquear la creación de la asamblea demo: los datos se pueden completar desde el panel.
      console.error('crear-asamblea-demo createDemoData:', demoErr)
    }

    const baseUrl = request.headers.get('origin') || request.nextUrl.origin
    // En sandbox puede ocurrir que el RPC falle por la configuración temporal
    // (p.ej. si aún no hay preguntas). No debe impedir que se cree la asamblea
    // demo; el admin podrá continuar luego en el panel.
    try {
      const { error: rpcError } = await admin.rpc('activar_votacion_publica', {
        p_asamblea_id: asamblea.id,
        p_base_url: baseUrl,
      })
      if (rpcError) console.error('crear-asamblea-demo activar_votacion_publica:', rpcError)
    } catch (rpcException) {
      console.error('crear-asamblea-demo activar_votacion_publica (exception):', rpcException)
    }

    // Activar demo y setear activated_at para que NO quede como solo lectura en el panel
    const nowIso = new Date().toISOString()
    await admin
      .from('asambleas')
      .update({ estado: 'activa', activated_at: nowIso })
      .eq('id', asamblea.id)

    return NextResponse.json({ asamblea: { ...asamblea, estado: 'activa', activated_at: nowIso } })
  } catch (e) {
    console.error('crear-asamblea-demo:', e)
    return NextResponse.json({ error: 'Error al crear la asamblea de demostración' }, { status: 500 })
  }
}
