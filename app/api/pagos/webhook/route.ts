import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Payload genérico: adaptable a Stripe, Wompi, etc. */
interface WebhookPayload {
  event?: string
  metadata?: {
    organization_id?: string
    conjunto_id?: string
  }
  external_payment_id?: string
  subscription_id?: string
  amount_cents?: number
  currency?: string
}

function getOrganizationId(payload: WebhookPayload): string | null {
  const meta = payload.metadata
  if (!meta) return null
  const id = meta.conjunto_id ?? meta.organization_id
  return typeof id === 'string' && UUID_REGEX.test(id) ? id : null
}

function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_PAGOS_SECRET
  if (!secret) return false
  const header = request.headers.get('x-webhook-secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return header === secret
}

export async function GET() {
  return NextResponse.json({ error: 'Método no permitido' }, { status: 405 })
}

/**
 * POST /api/pagos/webhook
 * Recibe notificaciones de la pasarela de pagos.
 * En 'pago_exitoso': actualiza el conjunto a plan Pro activo 1 año y registra en pagos_historial.
 */
export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: WebhookPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const event = body.event
  if (event !== 'pago_exitoso') {
    return NextResponse.json({ received: true, event }, { status: 200 })
  }

  const organizationId = getOrganizationId(body)
  if (!organizationId) {
    return NextResponse.json(
      { error: 'metadata.conjunto_id o metadata.organization_id (UUID) requerido' },
      { status: 400 }
    )
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' },
      { status: 500 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  )

  const externalPaymentId = body.external_payment_id ?? body.subscription_id ?? null
  if (externalPaymentId) {
    const { data: existing } = await supabase
      .from('pagos_historial')
      .select('id')
      .eq('external_payment_id', externalPaymentId)
      .eq('status', 'confirmed')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Conjunto no encontrado' }, { status: 404 })
  }

  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      plan_type: 'pro',
      plan_status: 'active',
      plan_active_until: oneYearLater.toISOString(),
      last_payment_date: now.toISOString(),
      ...(body.subscription_id && { subscription_id: body.subscription_id }),
    })
    .eq('id', organizationId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Error al actualizar conjunto', details: updateError.message },
      { status: 500 }
    )
  }

  const amountCents = typeof body.amount_cents === 'number' && body.amount_cents >= 0
    ? body.amount_cents
    : 0
  const currency = typeof body.currency === 'string' && body.currency.length <= 10
    ? body.currency
    : 'COP'

  const { error: insertError } = await supabase.from('pagos_historial').insert({
    organization_id: organizationId,
    amount_cents: amountCents,
    currency,
    external_payment_id: externalPaymentId,
    status: 'confirmed',
    plan_type: 'pro',
    description: 'Pago exitoso vía webhook - plan Pro 1 año',
  })

  if (insertError) {
    return NextResponse.json(
      { error: 'Conjunto actualizado; fallo al registrar pago', details: insertError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    received: true,
    organization_id: organizationId,
    plan_active_until: oneYearLater.toISOString(),
  })
}
