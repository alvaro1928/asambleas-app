import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/pagos/checkout-url
 * Genera la URL de la pasarela de pagos con el monto recalculado en el backend
 * usando el precio oficial de configuracion_global (evita manipulación en frontend).
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
    const cantidad = typeof cantidad_tokens === 'number' && cantidad_tokens >= 1
      ? Math.floor(cantidad_tokens)
      : typeof cantidad_tokens === 'string'
        ? Math.max(1, parseInt(cantidad_tokens, 10) || 1)
        : 1

    if (!userId) {
      return NextResponse.json({ error: 'user_id es requerido' }, { status: 400 })
    }

    const pasarelaBaseUrl = process.env.NEXT_PUBLIC_PASARELA_PAGOS_URL
    if (!pasarelaBaseUrl || !pasarelaBaseUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Pasarela de pagos no configurada' }, { status: 503 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
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
