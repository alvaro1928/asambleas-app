import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/super-admin'
import { registrarTransaccionPago } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/pagos/reprocesar
 * Reprocesa manualmente un pago aprobado en Wompi que no acreditó tokens (ej. webhook falló o no llegó).
 * Solo super-admin. Body: { wompi_transaction_id: string }
 * Idempotente: si ya está en pagos_log como APPROVED, no vuelve a acreditar.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
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
    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Solo super administrador' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const txId = typeof body?.wompi_transaction_id === 'string' ? body.wompi_transaction_id.trim() : null
    if (!txId) {
      return NextResponse.json({ error: 'Falta wompi_transaction_id en el body' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const privateKey = process.env.WOMPI_PRIVATE_KEY
    if (!supabaseUrl || !serviceRoleKey || !privateKey || !privateKey.startsWith('prv_')) {
      return NextResponse.json({
        error: 'Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o WOMPI_PRIVATE_KEY',
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const baseUrl = privateKey.startsWith('prv_prod_')
      ? 'https://production.wompi.co/v1'
      : 'https://sandbox.wompi.co/v1'

    const txRes = await fetch(`${baseUrl}/transactions/${encodeURIComponent(txId)}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
    })
    const txJson = await txRes.json().catch(() => ({}))
    const txData = txJson?.data ?? txJson
    const status = (txData?.status ?? '').toString().toUpperCase()
    const amountInCents = typeof txData?.amount_in_cents === 'number' ? txData.amount_in_cents : 0
    const paymentLinkId = txData?.payment_link_id ?? null

    if (status !== 'APPROVED') {
      return NextResponse.json({
        error: `La transacción no está aprobada en Wompi. Estado: ${status}`,
        status,
      }, { status: 400 })
    }

    const { data: existingLog } = await supabase
      .from('pagos_log')
      .select('id')
      .eq('wompi_transaction_id', txId)
      .eq('estado', 'APPROVED')
      .limit(1)
      .maybeSingle()
    if (existingLog) {
      return NextResponse.json({
        ok: true,
        message: 'Ya estaba procesada; no se vuelve a acreditar.',
        wompi_transaction_id: txId,
      }, { status: 200 })
    }

    let userId: string | null = null
    const linkId = paymentLinkId && typeof paymentLinkId === 'string' ? paymentLinkId.trim() : null
    if (!linkId) {
      return NextResponse.json({
        error: 'La transacción en Wompi no tiene payment_link_id; no se puede asociar al usuario.',
        wompi_transaction_id: txId,
      }, { status: 400 })
    }

    const linkRes = await fetch(`${baseUrl}/payment_links/${encodeURIComponent(linkId)}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
    })
    const linkJson = await linkRes.json().catch(() => ({}))
    const linkData = linkJson?.data ?? linkJson
    const sku = (typeof linkData?.sku === 'string' ? linkData.sku : null) ?? (typeof linkData?.attributes?.sku === 'string' ? linkData.attributes.sku : null)
    if (!sku || typeof sku !== 'string') {
      return NextResponse.json({
        error: 'El payment link no tiene sku; no se puede asociar al usuario.',
        wompi_transaction_id: txId,
      }, { status: 400 })
    }

    const { data: refRow } = await supabase
      .from('pagos_checkout_ref')
      .select('user_id')
      .eq('ref', sku.trim())
      .limit(1)
      .maybeSingle()
    if (refRow && typeof (refRow as { user_id?: string }).user_id === 'string') {
      userId = (refRow as { user_id: string }).user_id
    }
    if (!userId) {
      return NextResponse.json({
        error: 'No se encontró usuario para el ref/sku del checkout. El ref puede haber expirado o no existir en pagos_checkout_ref.',
        sku,
        wompi_transaction_id: txId,
      }, { status: 404 })
    }

    const { data: configRow } = await supabase
      .from('configuracion_global')
      .select('precio_por_token_cop')
      .eq('key', 'landing')
      .maybeSingle()
    const precioCop = configRow?.precio_por_token_cop != null ? Number(configRow.precio_por_token_cop) : 0
    const precioCentavosPorToken = Math.max(0, Math.round(precioCop * 100))
    if (precioCentavosPorToken <= 0) {
      return NextResponse.json({ error: 'Precio por token no configurado (configuracion_global)' }, { status: 500 })
    }
    const tokensComprados = Math.floor(amountInCents / precioCentavosPorToken)
    if (tokensComprados < 1) {
      return NextResponse.json({
        error: `Monto insuficiente para 1 token (${amountInCents} centavos, precio ${precioCop} COP)`,
      }, { status: 400 })
    }

    const { data: byUserId } = await supabase
      .from('profiles')
      .select('id, user_id, tokens_disponibles, organization_id')
      .eq('user_id', userId)
      .limit(1)
    let perfiles = Array.isArray(byUserId) ? byUserId : byUserId ? [byUserId] : []
    if (perfiles.length === 0) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id, user_id, tokens_disponibles, organization_id')
        .eq('id', userId)
        .limit(1)
      perfiles = Array.isArray(byId) ? byId : byId ? [byId] : []
    }
    if (perfiles.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado en profiles' }, { status: 404 })
    }
    const firstProfile = perfiles[0] as { tokens_disponibles?: number; organization_id?: string }
    const tokensActuales = Math.max(0, Number(firstProfile?.tokens_disponibles ?? 0))
    const nuevoSaldo = tokensActuales + tokensComprados
    const orgIdForLog = firstProfile?.organization_id ?? null

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
        return NextResponse.json({ error: 'Error al actualizar tokens', details: updateError.message }, { status: 500 })
      }
    }

    if (orgIdForLog) {
      await registrarTransaccionPago(supabase, {
        organization_id: orgIdForLog,
        monto: amountInCents,
        wompi_transaction_id: txId,
        estado: 'APPROVED',
      })
    }

    return NextResponse.json({
      ok: true,
      message: 'Pago reprocesado; tokens acreditados.',
      user_id: userId,
      tokens_comprados: tokensComprados,
      tokens_disponibles: nuevoSaldo,
      wompi_transaction_id: txId,
    })
  } catch (e) {
    console.error('[pagos reprocesar]', e)
    return NextResponse.json({ error: 'Error al reprocesar el pago' }, { status: 500 })
  }
}
