import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const MIN_TOKENS = 20

/** Genera una referencia corta para el sku del link de pago (máx 36 chars en Wompi). */
function generateShortRef(): string {
  return 'ck' + randomBytes(5).toString('hex')
}

/**
 * POST /api/pagos/checkout-url
 * Opción A: Si WOMPI_PRIVATE_KEY está definida, crea un payment link en Wompi y devuelve la URL.
 * Opción B: Si no, devuelve URL con NEXT_PUBLIC_PASARELA_PAGOS_URL + query params.
 * Body: { user_id: string, conjunto_id?: string, cantidad_tokens: number }
 * Respuesta: { url: string, monto_total_cop: number } o { error }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { user_id, conjunto_id, cantidad_tokens } = body as {
      user_id?: string
      conjunto_id?: string
      cantidad_tokens?: number
    }

    const userId = typeof user_id === 'string' ? user_id.trim() : null
    const conjId = typeof conjunto_id === 'string' ? conjunto_id.trim() || undefined : undefined
    const raw = typeof cantidad_tokens === 'number'
      ? Math.floor(cantidad_tokens)
      : typeof cantidad_tokens === 'string'
        ? parseInt(cantidad_tokens, 10) || 0
        : 0
    const cantidad = Math.max(MIN_TOKENS, raw)

    if (!userId) {
      return NextResponse.json({ error: 'user_id es requerido' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
    }

    // Solo permitir comprar tokens para la cuenta de la sesión actual
    const cookieStore = await cookies()
    const supabaseSession = createServerClient(supabaseUrl, anonKey, {
      cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
    })
    const { data: { session } } = await supabaseSession.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Debes iniciar sesión para recargar' }, { status: 401 })
    }
    if (session.user.id !== userId) {
      return NextResponse.json({ error: 'El user_id no coincide con tu sesión' }, { status: 403 })
    }

    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

    const { data: configRow, error: configError } = await supabase
      .from('configuracion_global')
      .select('precio_por_token_cop')
      .eq('key', 'landing')
      .maybeSingle()

    if (configError) {
      console.error('POST /api/pagos/checkout-url config:', configError)
      return NextResponse.json({ error: 'Error al obtener precio' }, { status: 500 })
    }

    const precioCop = configRow?.precio_por_token_cop != null
      ? Number(configRow.precio_por_token_cop)
      : 1500
    const montoTotalCop = Math.max(0, cantidad * precioCop)
    const amountInCents = Math.round(montoTotalCop * 100)

    const privateKey = process.env.WOMPI_PRIVATE_KEY
    if (privateKey && privateKey.startsWith('prv_')) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!serviceRoleKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
      }
      const shortRef = generateShortRef()
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      const { error: refError } = await admin.from('pagos_checkout_ref').insert({
        ref: shortRef,
        user_id: userId,
        amount_cents: amountInCents,
      })
      if (refError) {
        console.error('POST /api/pagos/checkout-url ref insert:', refError)
        return NextResponse.json({ error: 'Error al registrar referencia de pago' }, { status: 500 })
      }

      const baseUrl = privateKey.startsWith('prv_prod_')
        ? 'https://production.wompi.co/v1'
        : 'https://sandbox.wompi.co/v1'
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '') || 'https://epbco.cloud'
      const redirectUrl = `${siteUrl}/pago-ok`
      const res = await fetch(`${baseUrl}/payment_links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${privateKey}`,
        },
        body: JSON.stringify({
          name: 'Tokens - Asambleas App',
          description: `${cantidad} tokens para tu billetera`,
          single_use: true,
          collect_shipping: false,
          currency: 'COP',
          amount_in_cents: amountInCents,
          sku: shortRef,
          redirect_url: redirectUrl,
        }),
      })
      const json = await res.json().catch(() => ({}))
      const linkId = json?.data?.id
      if (!res.ok || !linkId) {
        console.error('Wompi payment_links:', res.status, json)
        return NextResponse.json({
          error: json?.error?.message || 'Error al crear el link de pago en Wompi',
        }, { status: 502 })
      }
      const checkoutUrl = `https://checkout.wompi.co/l/${linkId}`
      return NextResponse.json({ url: checkoutUrl, monto_total_cop: montoTotalCop })
    }

    const pasarelaBaseUrl = process.env.NEXT_PUBLIC_PASARELA_PAGOS_URL
    if (!pasarelaBaseUrl || !pasarelaBaseUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Pasarela de pagos no configurada. Configura WOMPI_PRIVATE_KEY o NEXT_PUBLIC_PASARELA_PAGOS_URL.' }, { status: 503 })
    }

    const separator = pasarelaBaseUrl.includes('?') ? '&' : '?'
    const params = new URLSearchParams()
    params.set('user_id', userId)
    if (conjId) params.set('conjunto_id', conjId)
    params.set('cantidad_tokens', String(cantidad))
    params.set('monto_total_cop', String(montoTotalCop))
    const url = `${pasarelaBaseUrl}${separator}${params.toString()}`
    return NextResponse.json({ url, monto_total_cop: montoTotalCop })
  } catch (e) {
    console.error('POST /api/pagos/checkout-url:', e)
    return NextResponse.json({ error: 'Error al generar URL de pago' }, { status: 500 })
  }
}
