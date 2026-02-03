import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { registrarTransaccionPago } from '@/lib/super-admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Referencia Wompi (modelo Billetera por Gestor): REF_<user_id>_<timestamp> */
function extractUserIdFromReference(reference: string | null | undefined): string | null {
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
      payment_link_id?: string | null
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
 * Modelo Billetera de Tokens por Gestor (sin suscripciones ni planes anuales).
 *
 * Seguridad: validación SHA256 con WEBHOOK_PAGOS_SECRET.
 * WEBHOOK_PAGOS_SECRET debe ser el secreto "Eventos" del panel de Wompi
 * (Configuraciones avanzadas → Secretos para integración técnica → Eventos).
 *
 * En Wompi, la URL de Eventos debe ser: https://tu-dominio/api/pagos/webhook
 * (no /dashboard).
 *
 * Idempotencia: si la transacción ya está en pagos_log como APPROVED, no se vuelve a acreditar.
 * Referencia: REF_<user_id>_<timestamp>. APPROVED: suma tokens a profiles.tokens_disponibles del gestor.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WOMPI_EVENTS_SECRET || process.env.WEBHOOK_PAGOS_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'WOMPI_EVENTS_SECRET o WEBHOOK_PAGOS_SECRET no configurado (usa el secreto Eventos de Wompi)' }, { status: 500 })
  }

  let body: WompiEventPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (body.event !== 'transaction.updated') {
    console.log('[webhook pagos] Evento ignorado (no transaction.updated):', body.event)
    return NextResponse.json({ received: true, event: body.event }, { status: 200 })
  }

  const data = body.data ?? {}
  const transaction = data.transaction ?? {}
  const txId = transaction.id ?? null
  const reference = transaction.reference ?? null
  const paymentLinkId = transaction.payment_link_id ?? null
  const status = (transaction.status ?? '').toString().toUpperCase()
  const amountInCents = typeof transaction.amount_in_cents === 'number' ? transaction.amount_in_cents : 0

  console.log('[webhook pagos] Evento recibido:', { txId, reference, payment_link_id: paymentLinkId, status, amount_in_cents: amountInCents })

  const signature = body.signature ?? {}
  const checksumHeader = request.headers.get('x-event-checksum')
  const checksumToVerify = signature.checksum ?? checksumHeader ?? ''
  if (!verifyWompiSignature(data, { ...signature, checksum: checksumToVerify }, secret)) {
    console.error('[webhook pagos] Firma de integridad inválida')
    return NextResponse.json({ error: 'Firma de integridad inválida' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  let userId = extractUserIdFromReference(reference)
  if (!userId && reference && typeof reference === 'string') {
    const { data: refRow } = await supabase
      .from('pagos_checkout_ref')
      .select('user_id')
      .eq('ref', reference.trim())
      .limit(1)
      .maybeSingle()
    if (refRow && typeof (refRow as { user_id?: string }).user_id === 'string') {
      userId = (refRow as { user_id: string }).user_id
      console.log('[webhook pagos] user_id resuelto por referencia en pagos_checkout_ref')
    }
  }

  let linkIdToResolve = paymentLinkId && typeof paymentLinkId === 'string' ? paymentLinkId.trim() : null
  // PSE y otros métodos a veces no envían payment_link_id en el evento: intentar GET transaction
  if (!userId && !linkIdToResolve && txId && typeof txId === 'string') {
    const privateKey = process.env.WOMPI_PRIVATE_KEY
    if (privateKey && privateKey.startsWith('prv_')) {
      const baseUrl = privateKey.startsWith('prv_prod_')
        ? 'https://production.wompi.co/v1'
        : 'https://sandbox.wompi.co/v1'
      try {
        const txRes = await fetch(`${baseUrl}/transactions/${encodeURIComponent(txId)}`, {
          headers: { Authorization: `Bearer ${privateKey}` },
        })
        const txJson = await txRes.json().catch(() => ({}))
        const fromTx = txJson?.data?.payment_link_id ?? txJson?.payment_link_id ?? null
        if (fromTx && typeof fromTx === 'string') {
          linkIdToResolve = fromTx.trim()
          console.log('[webhook pagos] payment_link_id obtenido por GET transaction:', linkIdToResolve)
        } else {
          console.log('[webhook pagos] GET transaction sin payment_link_id:', txRes.status, Object.keys(txJson?.data ?? txJson ?? {}))
        }
      } catch (e) {
        console.error('[webhook pagos] Error al obtener transaction por id:', e)
      }
    }
  }

  // Resolver usuario por payment link: obtener sku y buscar en pagos_checkout_ref
  if (!userId && linkIdToResolve) {
    const privateKey = process.env.WOMPI_PRIVATE_KEY
    if (privateKey && privateKey.startsWith('prv_')) {
      const baseUrl = privateKey.startsWith('prv_prod_')
        ? 'https://production.wompi.co/v1'
        : 'https://sandbox.wompi.co/v1'
      try {
        const linkRes = await fetch(`${baseUrl}/payment_links/${encodeURIComponent(linkIdToResolve)}`, {
          headers: { Authorization: `Bearer ${privateKey}` },
        })
        const linkJson = await linkRes.json().catch(() => ({}))
        const data = linkJson?.data ?? linkJson
        const sku = (typeof data?.sku === 'string' ? data.sku : null) ?? (typeof data?.attributes?.sku === 'string' ? data.attributes.sku : null)
        if (sku && typeof sku === 'string') {
          const { data: refRow } = await supabase
            .from('pagos_checkout_ref')
            .select('user_id')
            .eq('ref', sku.trim())
            .limit(1)
            .maybeSingle()
          if (refRow && typeof (refRow as { user_id?: string }).user_id === 'string') {
            userId = (refRow as { user_id: string }).user_id
            console.log('[webhook pagos] user_id resuelto por payment_link + sku:', sku)
          } else {
            console.log('[webhook pagos] sku del link no encontrado en pagos_checkout_ref:', sku)
          }
        } else {
          console.log('[webhook pagos] payment link sin sku. status:', linkRes.status, 'data_keys:', data ? Object.keys(data) : [])
        }
      } catch (e) {
        console.error('[webhook pagos] Error al obtener payment link:', e)
      }
    } else if (!userId) {
      console.log('[webhook pagos] WOMPI_PRIVATE_KEY no configurada; no se puede resolver por payment_link_id')
    }
  }

  if (status === 'APPROVED') {
    if (!userId) {
      console.error('[webhook pagos] APPROVED pero user_id no resuelto. reference:', reference, 'payment_link_id:', paymentLinkId)
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Referencia sin UUID válido (REF_USERID_TIMESTAMP o ref en pagos_checkout_ref)')
      return NextResponse.json({ error: 'Referencia inválida: se espera REF_<user_id>_<timestamp> o ref de checkout' }, { status: 400 })
    }

    // Idempotencia: no procesar el mismo pago dos veces
    if (txId) {
      const { data: existingLog } = await supabase
        .from('pagos_log')
        .select('id, estado')
        .eq('wompi_transaction_id', txId)
        .eq('estado', 'APPROVED')
        .limit(1)
        .maybeSingle()
      if (existingLog) {
        const { data: profByUser } = await supabase
          .from('profiles')
          .select('tokens_disponibles')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()
        let currentTokens = Math.max(0, Number((profByUser as { tokens_disponibles?: number } | null)?.tokens_disponibles ?? 0))
        if (profByUser == null) {
          const { data: profById } = await supabase
            .from('profiles')
            .select('tokens_disponibles')
            .eq('id', userId)
            .limit(1)
            .maybeSingle()
          currentTokens = Math.max(0, Number((profById as { tokens_disponibles?: number } | null)?.tokens_disponibles ?? 0))
        }
        return NextResponse.json({
          received: true,
          skipped: 'already_processed',
          user_id: userId,
          tokens_disponibles: currentTokens,
        }, { status: 200 })
      }
    }

    const { data: configRow } = await supabase
      .from('configuracion_global')
      .select('precio_por_token_cop')
      .eq('key', 'landing')
      .maybeSingle()

    const precioCop = configRow?.precio_por_token_cop != null ? Number(configRow.precio_por_token_cop) : 0
    const precioCentavosPorToken = Math.max(0, Math.round(precioCop * 100))
    if (precioCentavosPorToken <= 0) {
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Precio por token no configurado (configuracion_global.precio_por_token_cop)')
      return NextResponse.json({ received: true, skipped: 'precio_no_configurado' }, { status: 200 })
    }
    const tokensComprados = Math.floor(amountInCents / precioCentavosPorToken)
    if (tokensComprados < 1) {
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, `Monto insuficiente para 1 token (precio ${precioCop} COP = ${precioCentavosPorToken} centavos)`)
      return NextResponse.json({ received: true, skipped: 'monto_insuficiente' }, { status: 200 })
    }

    // Buscar perfil por user_id o por id (auth user id = profiles.id en esquema clásico)
    const { data: byUserId } = await supabase
      .from('profiles')
      .select('id, user_id, tokens_disponibles, organization_id')
      .eq('user_id', userId)
      .limit(1)

    let perfilesGestor: Array<{ tokens_disponibles?: number; organization_id?: string }> = Array.isArray(byUserId) ? byUserId : byUserId ? [byUserId] : []
    if (perfilesGestor.length === 0) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id, user_id, tokens_disponibles, organization_id')
        .eq('id', userId)
        .limit(1)
      perfilesGestor = Array.isArray(byId) ? byId : byId ? [byId] : []
    }
    if (perfilesGestor.length === 0) {
      await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Usuario/gestor no encontrado en profiles')
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    const firstProfile = perfilesGestor[0] as { tokens_disponibles?: number; organization_id?: string } | undefined
    const tokensActuales = Math.max(0, Number(firstProfile?.tokens_disponibles ?? 0))
    const nuevoSaldo = tokensActuales + tokensComprados
    const orgIdForLog = firstProfile?.organization_id ?? null

    // Actualizar tokens: por user_id o por id (compatibilidad con esquemas id = auth uid)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ tokens_disponibles: nuevoSaldo })
      .eq('user_id', userId)

    if (updateError) {
      const { error: byIdUpdate } = await supabase
        .from('profiles')
        .update({ tokens_disponibles: nuevoSaldo })
        .eq('id', userId)
      if (byIdUpdate) {
        await logPaymentError(supabase, orgIdForLog, reference, txId, amountInCents, status, updateError.message)
        return NextResponse.json({ error: 'Error al actualizar tokens', details: updateError.message }, { status: 500 })
      }
    }

    if (orgIdForLog) {
      const { error: logError } = await registrarTransaccionPago(supabase, {
        organization_id: orgIdForLog,
        monto: amountInCents,
        wompi_transaction_id: txId,
        estado: 'APPROVED',
      })
      if (logError) {
        console.error('[webhook pagos] Error al registrar transacción:', logError.message)
      }
    }

    console.log('[webhook pagos] Tokens acreditados:', { user_id: userId, tokens_comprados: tokensComprados, nuevo_saldo: nuevoSaldo, txId })
    return NextResponse.json({
      received: true,
      user_id: userId,
      tokens_disponibles: nuevoSaldo,
      tokens_comprados: tokensComprados,
    })
  }

  // Pago no aprobado: registrar para revisión si tenemos user_id y un org para el log
  if (userId) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
    const first = Array.isArray(perfiles) ? perfiles[0] : perfiles
    const orgId = (first as { organization_id?: string } | undefined)?.organization_id
    if (orgId) {
      await registrarTransaccionPago(supabase, {
        organization_id: orgId,
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
