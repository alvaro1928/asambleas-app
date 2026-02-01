import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { registrarTransaccionPago } from '@/lib/super-admin'

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
 *
 * Variables de entorno:
 *   NEXT_PUBLIC_WOMPI_PUBLIC_KEY = Llave pública Wompi (frontend/checkout).
 *   WEBHOOK_PAGOS_SECRET = Secreto para validar firma de integridad (SHA256).
 *
 * Validación: firma SHA256 con WEBHOOK_PAGOS_SECRET.
 * Activación APPROVED: precio en planes (fila pro); si monto coincide, suma 1 a
 * tokens_disponibles del conjunto_id de la referencia (REF_<conjunto_id>_<timestamp>).
 * Registro: lib/super-admin.registrarTransaccionPago.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_PAGOS_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'WEBHOOK_PAGOS_SECRET no configurado' }, { status: 500 })
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
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Referencia sin UUID válido (REF_CONJUNTOID_TIMESTAMP)')
      return NextResponse.json({ error: 'Referencia inválida: se espera REF_<conjunto_id>_<timestamp>' }, { status: 400 })
    }

    const { data: org } = await supabase.from('organizations').select('id, tokens_disponibles').eq('id', conjuntoId).maybeSingle()
    if (!org) {
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Conjunto no encontrado')
      return NextResponse.json({ error: 'Conjunto no encontrado' }, { status: 404 })
    }

    const { data: planPro } = await supabase
      .from('planes')
      .select('precio_por_asamblea_cop')
      .eq('key', 'pro')
      .maybeSingle()

    const precioCop = planPro ? Number((planPro as { precio_por_asamblea_cop?: number }).precio_por_asamblea_cop ?? 0) : 0
    const montoCoincide =
      precioCop > 0 &&
      (amountInCents === Math.round(precioCop) || amountInCents === Math.round(precioCop * 100))

    if (!montoCoincide) {
      await logPaymentError(supabase, conjuntoId, reference, txId, amountInCents, status, `Monto no coincide con Plan Pro (precio COP: ${precioCop})`)
      return NextResponse.json({ received: true, skipped: 'monto_no_coincide' }, { status: 200 })
    }

    const tokensActuales = Math.max(0, Number((org as { tokens_disponibles?: number }).tokens_disponibles ?? 0))
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ tokens_disponibles: tokensActuales + 1 })
      .eq('id', conjuntoId)

    if (updateError) {
      await logPaymentError(supabase, conjuntoId, reference, txId, amountInCents, status, updateError.message)
      return NextResponse.json({ error: 'Error al actualizar tokens', details: updateError.message }, { status: 500 })
    }

    const { error: logError } = await registrarTransaccionPago(supabase, {
      organization_id: conjuntoId,
      monto: amountInCents,
      wompi_transaction_id: txId,
      estado: 'APPROVED',
    })
    if (logError) {
      console.error('[webhook pagos] Error al registrar transacción:', logError.message)
    }

    return NextResponse.json({
      received: true,
      organization_id: conjuntoId,
      tokens_disponibles: tokensActuales + 1,
    })
  }

  // Pago no aprobado: registrar transacción para revisión (solo si podemos asociar a un conjunto)
  if (conjuntoId) {
    const { data: org } = await supabase.from('organizations').select('id').eq('id', conjuntoId).maybeSingle()
    if (org) {
      await registrarTransaccionPago(supabase, {
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
    await registrarTransaccionPago(supabase, {
      organization_id: organizationId,
      monto,
      wompi_transaction_id: wompiTransactionId,
      estado: estado || 'ERROR',
    })
  }
  console.error('[webhook pagos]', { organizationId, reference, wompiTransactionId, estado, detalle })
}
