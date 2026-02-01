import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { planEfectivo } from '@/lib/plan-utils'

/**
 * POST /api/dashboard/crear-asamblea
 * Crea una asamblea y, si el plan no es Pro (Free/Pilot), descuenta 1 token del conjunto.
 * Los tokens son del conjunto (organization); las cuentas (admins) administran conjuntos.
 * Requiere sesión y que el usuario tenga perfil en la organización.
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
    const { organization_id, nombre, descripcion, fecha } = body as {
      organization_id?: string
      nombre?: string
      descripcion?: string
      fecha?: string
    }

    if (!organization_id || !nombre?.trim() || !fecha) {
      return NextResponse.json(
        { error: 'Faltan organization_id, nombre o fecha' },
        { status: 400 }
      )
    }

    // Verificar que el usuario tiene perfil en esta organización
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'No tienes acceso a este conjunto' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Obtener plan y tokens del conjunto
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('plan_type, plan_active_until, tokens_disponibles')
      .eq('id', organization_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Conjunto no encontrado' }, { status: 404 })
    }

    const plan = planEfectivo(
      (org as { plan_type?: string }).plan_type,
      (org as { plan_active_until?: string }).plan_active_until
    )
    const tokens = Number((org as { tokens_disponibles?: number }).tokens_disponibles ?? 0)

    // Solo Pro es ilimitado. Free y Pilot consumen 1 token por asamblea nueva.
    if (plan !== 'pro' && tokens < 1) {
      return NextResponse.json(
        { error: 'No tienes tokens disponibles. Compra asambleas Pro o actualiza tu plan.', code: 'SIN_TOKENS' },
        { status: 402 }
      )
    }

    const fechaHora = fecha.length <= 10 ? `${fecha}T10:00:00` : fecha

    const { data: asamblea, error: insertError } = await admin
      .from('asambleas')
      .insert({
        organization_id,
        nombre: nombre.trim(),
        descripcion: (descripcion?.trim() || null) as string | null,
        fecha: fechaHora,
        estado: 'borrador',
      })
      .select()
      .single()

    if (insertError) {
      console.error('crear-asamblea insert:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Descontar 1 token para Free y Pilot (Pro es ilimitado)
    if (plan !== 'pro') {
      await admin
        .from('organizations')
        .update({
          tokens_disponibles: Math.max(0, tokens - 1),
        })
        .eq('id', organization_id)
    }

    return NextResponse.json({ asamblea })
  } catch (e) {
    console.error('crear-asamblea:', e)
    return NextResponse.json({ error: 'Error al crear la asamblea' }, { status: 500 })
  }
}
