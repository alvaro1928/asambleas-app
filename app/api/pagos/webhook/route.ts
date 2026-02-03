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
  fullBody: { sent_at?: string; timestamp?: number },
  signature: { properties?: string[]; timestamp?: number; checksum?: string },
  secret: string
): boolean {
  let props = signature?.properties
  let timestamp = signature?.timestamp ?? fullBody?.timestamp
  const expectedChecksum = signature?.checksum
  if (!expectedChecksum) return false

  // Fallback: si Wompi solo envía checksum (ej. en header) sin properties/timestamp en body,
  // usar estructura conocida de transaction.updated (doc Wompi)
  if ((!Array.isArray(props) || props.length === 0 || timestamp == null) && data?.transaction) {
    const tx = data.transaction as Record<string, unknown>
    props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
    if (timestamp == null) {
      const sentAt = fullBody?.sent_at ? Date.parse(fullBody.sent_at) : NaN
      const finalized = tx.finalized_at != null
        ? (typeof tx.finalized_at === 'string' ? Date.parse(tx.finalized_at) : Number(tx.finalized_at))
        : NaN
      const created = tx.created_at != null
        ? (typeof tx.created_at === 'string' ? Date.parse(tx.created_at) : Number(tx.created_at))
        : NaN
      timestamp = Number.isFinite(sentAt) ? sentAt : (Number.isFinite(finalized) ? finalized : (Number.isFinite(created) ? created : undefined))
    }
  }

  if (!Array.isArray(props) || props.length === 0 || timestamp == null) return false

  const parts: (string | number)[] = []
  for (const path of props) {
    const v = getNestedValue(data, path)
    if (v === null) return false
    parts.push(v)
  }

  const receivedHex = expectedChecksum.toLowerCase().replace(/\s/g, '')

  // Doc Wompi: timestamp puede ser UNIX en segundos o milisegundos; probar ambos
  const timestampsToTry: number[] = [
    timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp,
    timestamp,
  ]
  const uniqueTimestamps = Array.from(new Set(timestampsToTry))

  for (const ts of uniqueTimestamps) {
    const concatenated = parts.join('') + ts + secret
    const hash = createHash('sha256').update(concatenated, 'utf8').digest('hex')
    if (hash.length !== receivedHex.length) continue
    try {
      if (timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(receivedHex, 'hex'))) return true
    } catch {
      // continue
    }
  }
  return false
}

/** Payload Wompi evento transaction.updated */
interface WompiEventPayload {
  event?: string
  data?: {
    transaction?: Record<string, unknown>
  }
  signature?: {
    properties?: string[]
    timestamp?: number
    checksum?: string
  }
  /** Timestamp UNIX del evento (algunos entornos lo envían en la raíz) */
  timestamp?: number
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
  const txId = typeof transaction.id === 'string' ? transaction.id : null
  const reference = typeof transaction.reference === 'string' ? transaction.reference : null
  const paymentLinkId = transaction.payment_link_id != null && typeof transaction.payment_link_id === 'string' ? transaction.payment_link_id : null
  const status = (transaction.status ?? '').toString().toUpperCase()
  const amountInCents = typeof transaction.amount_in_cents === 'number' ? transaction.amount_in_cents : 0

  console.log('[webhook pagos] Evento recibido:', { txId, reference, payment_link_id: paymentLinkId, status, amount_in_cents: amountInCents })

  const signature = body.signature ?? {}
  const checksumHeader = request.headers.get('x-event-checksum')
  const checksumToVerify = signature.checksum ?? checksumHeader ?? ''
  const timestamp = signature.timestamp ?? body.timestamp
  const isValid = verifyWompiSignature(data, body, { ...signature, timestamp, checksum: checksumToVerify }, secret)
  if (!isValid) {
    console.error('[webhook pagos] Firma de integridad inválida', {
      hasSignature: !!body.signature,
      hasProperties: Array.isArray(signature.properties) && signature.properties.length > 0,
      hasTimestamp: timestamp != null,
      hasChecksum: !!checksumToVerify,
      timestampFrom: body.timestamp != null ? 'root' : (signature.timestamp != null ? 'signature' : 'none'),
    })
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
      // 200 para que Wompi no reintente; el pago ya está aprobado y no podemos acreditar sin user
      return NextResponse.json({ received: true, skipped: 'user_not_resolved', error: 'Referencia inválida' }, { status: 200 })
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
        const { data: profById } = await supabase
          .from('profiles')
          .select('tokens_disponibles')
          .eq('id', userId)
          .limit(1)
          .maybeSingle()
        const currentTokens = Math.max(0, Number((profById as { tokens_disponibles?: number } | null)?.tokens_disponibles ?? 0))
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

    // Buscar perfil por id (profiles.id = auth.uid en esquema clásico; sin columna user_id)
    let { data: byId } = await supabase
      .from('profiles')
      .select('id, tokens_disponibles, organization_id')
      .eq('id', userId)
      .limit(1)

    let perfilesGestor: Array<{ tokens_disponibles?: number; organization_id?: string }> = Array.isArray(byId) ? byId : byId ? [byId] : []

    // Si no hay perfil, crear uno mínimo (id = auth.uid; FK a auth.users). Evita depender de auth.admin en serverless.
    if (perfilesGestor.length === 0) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: userId,
        user_id: userId,
        email: null,
        full_name: null,
        organization_id: null,
        role: 'member',
        tokens_disponibles: 0,
      })
      if (insertError) {
        const msg = insertError.message ?? ''
        const isFk = /foreign key|violates foreign key|auth\.users/i.test(msg)
        const isDuplicate = /duplicate key|unique constraint|already exists/i.test(msg)
        if (isFk) {
          console.error('[webhook pagos] Usuario no existe en Auth (FK). user_id:', userId, 'txId:', txId)
          await logPaymentError(supabase, null, reference, txId, amountInCents, status, 'Usuario no existe en Auth (FK profiles.id -> auth.users)')
          return NextResponse.json({ received: true, skipped: 'user_not_in_auth', error: 'Usuario no encontrado' }, { status: 200 })
        }
        if (isDuplicate) {
          const { data: retry } = await supabase.from('profiles').select('id, tokens_disponibles, organization_id').eq('id', userId).limit(1).maybeSingle()
          if (retry) {
            perfilesGestor = [retry as { tokens_disponibles?: number; organization_id?: string }]
          } else {
            await logPaymentError(supabase, null, reference, txId, amountInCents, status, insertError.message)
            return NextResponse.json({ error: 'Error al crear perfil', details: insertError.message }, { status: 500 })
          }
        } else {
          await logPaymentError(supabase, null, reference, txId, amountInCents, status, insertError.message)
          return NextResponse.json({ error: 'Error al crear perfil', details: insertError.message }, { status: 500 })
        }
      } else {
        console.log('[webhook pagos] Perfil creado para user_id (sin fila previa):', userId)
        perfilesGestor = [{ tokens_disponibles: 0, organization_id: undefined }]
      }
    }
    const firstProfile = perfilesGestor[0] as { tokens_disponibles?: number; organization_id?: string } | undefined
    const tokensActuales = Math.max(0, Number(firstProfile?.tokens_disponibles ?? 0))
    const nuevoSaldo = tokensActuales + tokensComprados
    // Cualquier organización del usuario para pagos_log
    let orgIdForLog =
      firstProfile?.organization_id ??
      (perfilesGestor as Array<{ organization_id?: string }>).map((p) => p.organization_id).filter(Boolean)[0] ??
      null
    if (!orgIdForLog) {
      const { data: anyOrg } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .not('organization_id', 'is', null)
        .limit(1)
        .maybeSingle()
      orgIdForLog = (anyOrg as { organization_id?: string } | null)?.organization_id ?? null
    }

    // Billetera única por gestor: actualizar TODAS las filas del usuario (cada conjunto puede tener una fila en profiles)
    let updatedCount = 0
    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update({ tokens_disponibles: nuevoSaldo })
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .select('id')
    if (!updateError) {
      updatedCount = Array.isArray(updatedRows) ? updatedRows.length : updatedRows ? 1 : 0
    } else if (updateError && /user_id|column/i.test(updateError.message)) {
      const { data: rowsById, error: errById } = await supabase
        .from('profiles')
        .update({ tokens_disponibles: nuevoSaldo })
        .eq('id', userId)
        .select('id')
      if (errById) {
        await logPaymentError(supabase, orgIdForLog, reference, txId, amountInCents, status, errById.message)
        return NextResponse.json({ error: 'Error al actualizar tokens', details: errById.message }, { status: 500 })
      }
      updatedCount = Array.isArray(rowsById) ? rowsById.length : rowsById ? 1 : 0
    } else {
      await logPaymentError(supabase, orgIdForLog, reference, txId, amountInCents, status, updateError.message)
      return NextResponse.json({ error: 'Error al actualizar tokens', details: updateError.message }, { status: 500 })
    }
    if (updatedCount === 0) {
      await logPaymentError(supabase, orgIdForLog, reference, txId, amountInCents, status, 'Update tokens: 0 filas afectadas')
      return NextResponse.json({ error: 'No se pudo actualizar el perfil del usuario' }, { status: 500 })
    }

    // Siempre registrar en pagos_log si tenemos al menos una org del usuario
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
      .eq('id', userId)
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
