import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { planEfectivo } from '@/lib/plan-utils'

/**
 * GET /api/dashboard/organization-status?organization_id=xxx
 * Devuelve plan_type, plan_active_until, tokens_disponibles y plan_efectivo del conjunto.
 * Los tokens son del conjunto (organization); las cuentas (admins) administran conjuntos.
 * Solo si el usuario tiene perfil en esa organización.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Falta organization_id' },
        { status: 400 }
      )
    }

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(
        { error: 'No tienes acceso a este conjunto' },
        { status: 403 }
      )
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('plan_type, plan_active_until, tokens_disponibles')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Conjunto no encontrado' },
        { status: 404 }
      )
    }

    const planType = (org as { plan_type?: string }).plan_type ?? null
    const planActiveUntil = (org as { plan_active_until?: string | null })
      .plan_active_until ?? null
    const tokensDisponibles = Number(
      (org as { tokens_disponibles?: number }).tokens_disponibles ?? 0
    )
    const plan = planEfectivo(planType, planActiveUntil)

    return NextResponse.json({
      plan_type: planType,
      plan_active_until: planActiveUntil,
      tokens_disponibles: tokensDisponibles,
      plan_efectivo: plan,
    })
  } catch (e) {
    console.error('organization-status:', e)
    return NextResponse.json(
      { error: 'Error al obtener el estado del conjunto' },
      { status: 500 }
    )
  }
}
