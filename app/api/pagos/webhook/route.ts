import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Referencia Wompi: REF_<conjunto_id>_<timestamp> */
function extractConjuntoIdFromReference(reference: string | null | undefined): string | null {
  if (!reference || typeof reference !== 'string') return null
  const parts = reference.trim().split('_')
  if (parts.length < 2) return null
  const maybeUuid = parts[1]
  return UUID_REGEX.test(maybeUuid) ? maybeUuid : null
}

/** Obtener valor anidado en objeto por path "transaction.id" -> data.transaction.id */
function getNestedValue(obj: unknown, path: string): string | number | null {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]
  }
  if (current === null || current === undefined) return null
  if (typeof current === 'string' || typeof current === 'number') return current
  return String(current)
}

/** Verificar firma de integridad Wompi (SHA256 de properties + timestamp + secret). */
function verifyWompiSignature(
  data: Record<string, unknown>,
  signature: { properties?: string[]; timestamp?: number; checksum?: string },
  secret: string
): boolean {
  const props = signature?.properties
  const timestamp = signature?.timestamp
  const expectedChecksum = signature?.checksum
  if (!Array.isArray(props) || props.length === 0 || timestamp == null || !expectedChecksum) return false
  const parts: (string | number)[] = []
  for (const path of props) {
    const v = getNestedValue(data, path)
    if (v === null) return false
    parts.push(v)
  }
  parts.push(timestamp)
  const concatenated = parts.join('') + secret
  const hash = createHash('sha256').update(concatenated, 'utf8').digest('hex')
  if (hash.length !== expectedChecksum.length) return false
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedChecksum.toLowerCase(), 'hex'))
  } catch {
    return false
  }
}

/** Payload Wompi evento transaction.updated */
interface WompiEventPayload {
  event?: string
  data?: {
    transaction?: {
      id?: string
      reference?: string
      status?: string
      amount_in_cents?: number
      currency?: string
    }
  }
  signature?: {
    properties?: string[]
    timestamp?: number
    checksum?: string
  }
  sent_at?: string
}

export async function GET() {
  return NextResponse.json({ error: 'Método no permitido' }, { status: 405 })
}

/**
 * POST /api/pagos/webhook
 * Webhook Wompi: evento transaction.updated.
 * Verifica firma SHA256 con WOMPI_INTEGRIDAD (secreto Integridad de Wompi).
 * Si status === APPROVED: extrae conjunto_id de reference (REF_UUID_TIMESTAMP), activa plan Pro 365 días.
 * Si falla: registra en pagos_log para revisión.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WOMPI_INTEGRIDAD
  if (!secret) {
    return NextResponse.json({ error: 'WOMPI_INTEGRIDAD no configurado' }, { status: 500 })
  }

  let body: WompiEventPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (body.event !== 'transaction.updated') {
    return NextResponse.json({ received: true, event: body.event }, { status: 200 })
  }

  const data = body.data ?? {}
  const transaction = data.transaction ?? {}
  const txId = transaction.id ?? null
  const reference = transaction.reference ?? null
  const status = (transaction.status ?? '').toString().toUpperCase()
  const amountInCents = typeof transaction.amount_in_cents === 'number' ? transaction.amount_in_cents : 0

  const signature = body.signature ?? {}
  const checksumHeader = request.headers.get('x-event-checksum')
  const checksumToVerify = signature.checksum ?? checksumHeader ?? ''
  if (!verifyWompiSignature(data, { ...signature, checksum: checksumToVerify }, secret)) {
    return NextResponse.json({ error: 'Firma de integridad inválida' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const conjuntoId = extractConjuntoIdFromReference(reference)

  if (status === 'APPROVED') {
    if (!conjuntoId) {
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Referencia sin UUID válido (REF_UUID_TIMESTAMP)')
      return NextResponse.json({ error: 'Referencia inválida: se espera REF_<uuid>_<timestamp>' }, { status: 400 })
    }

    const { data: org } = await supabase.from('organizations').select('id').eq('id', conjuntoId).maybeSingle()
    if (!org) {
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Conjunto no encontrado')
      return NextResponse.json({ error: 'Conjunto no encontrado' }, { status: 404 })
    }

    const now = new Date()
    const activeUntil = new Date(now)
    activeUntil.setDate(activeUntil.getDate() + 365)

    const nowIso = now.toISOString()
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        plan_type: 'pro',
        subscription_status: 'active',
        plan_active_until: activeUntil.toISOString(),
        last_payment_date: nowIso,
        wompi_reference: reference,
      })
      .eq('id', conjuntoId)

    if (updateError) {
      await logPaymentError(supabase, conjuntoId, reference, txId, amountInCents, status, updateError.message)
      return NextResponse.json({ error: 'Error al actualizar conjunto', details: updateError.message }, { status: 500 })
    }

    const { error: logError } = await supabase.from('pagos_log').insert({
      organization_id: conjuntoId,
      monto: amountInCents,
      wompi_transaction_id: txId,
      estado: 'APPROVED',
    })
    if (logError) {
      // No fallar la respuesta; el plan ya se activó
      console.error('[webhook pagos] Error al insertar pagos_log:', logError.message)
    }

    return NextResponse.json({
      received: true,
      organization_id: conjuntoId,
      plan_active_until: activeUntil.toISOString(),
    })
  }

  // Pago no aprobado: registrar en pagos_log para revisión (solo si podemos asociar a un conjunto)
  if (conjuntoId) {
    const { data: org } = await supabase.from('organizations').select('id').eq('id', conjuntoId).maybeSingle()
    if (org) {
      await supabase.from('pagos_log').insert({
        organization_id: conjuntoId,
        monto: amountInCents,
        wompi_transaction_id: txId,
        estado: status || 'UNKNOWN',
      })
    }
  } else {
    await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Referencia sin UUID (pago no aprobado)')
  }

  return NextResponse.json({ received: true, status }, { status: 200 })
}

/**
 * Registrar error en pagos_log cuando no hay organization_id.
 * pagos_log exige organization_id NOT NULL; si no tenemos conjunto, guardamos en una tabla de errores
 * o no insertamos. Aquí intentamos insertar solo cuando tenemos organization_id.
 * Para errores sin conjunto usamos console y opcionalmente una tabla pagos_log_errores si existiera.
 */
async function logPaymentError(
  supabase: SupabaseClient,
  organizationId: string | null,
  reference: string | null,
  wompiTransactionId: string | null,
  monto: number,
  estado: string,
  detalle: string
) {
  if (organizationId) {
    await supabase.from('pagos_log').insert({
      organization_id: organizationId,
      monto,
      wompi_transaction_id: wompiTransactionId,
      estado: estado || 'ERROR',
    })
  }
  console.error('[webhook pagos]', { organizationId, reference, wompiTransactionId, estado, detalle })
}
