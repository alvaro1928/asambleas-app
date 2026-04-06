import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/config/public
 * Configuración pública para la Landing (sin autenticación).
 * El precio por token se lee siempre de configuracion_global.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

    const selectBase =
      'titulo, subtitulo, whatsapp_number, color_principal_hex, precio_por_token_cop, bono_bienvenida_tokens, texto_hero_precio, texto_ahorro, cta_whatsapp_text'

    type ConfigPublicRow = {
      titulo?: string | null
      subtitulo?: string | null
      whatsapp_number?: string | null
      color_principal_hex?: string | null
      precio_por_token_cop?: number | null
      bono_bienvenida_tokens?: number | null
      texto_hero_precio?: string | null
      texto_ahorro?: string | null
      cta_whatsapp_text?: string | null
      ventana_gracia_activacion_dias?: number | null
    }

    const primera = await supabase
      .from('configuracion_global')
      .select(`${selectBase}, ventana_gracia_activacion_dias`)
      .eq('key', 'landing')
      .maybeSingle()

    let data: ConfigPublicRow | null = primera.data as ConfigPublicRow | null
    let error = primera.error

    if (
      error &&
      (error.code === '42703' || String(error.message).includes('ventana_gracia_activacion_dias'))
    ) {
      const retry = await supabase.from('configuracion_global').select(selectBase).eq('key', 'landing').maybeSingle()
      data = retry.data as ConfigPublicRow | null
      error = retry.error
    }

    if (error) {
      console.error('GET /api/config/public:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data

    const precioPorTokenCop = row?.precio_por_token_cop != null ? Number(row.precio_por_token_cop) : 1500
    const rawDias = row?.ventana_gracia_activacion_dias != null ? Number(row.ventana_gracia_activacion_dias) : 5
    const ventanaGraciaDias =
      Number.isFinite(rawDias) && rawDias >= 1 && rawDias <= 90 ? Math.floor(rawDias) : 5

    const res = NextResponse.json({
      titulo: row?.titulo ?? null,
      subtitulo: row?.subtitulo ?? null,
      whatsapp_number: row?.whatsapp_number ?? null,
      color_principal_hex: row?.color_principal_hex ?? null,
      precio_por_token_cop: precioPorTokenCop,
      bono_bienvenida_tokens: row?.bono_bienvenida_tokens != null ? Number(row.bono_bienvenida_tokens) : null,
      texto_hero_precio: row?.texto_hero_precio ?? null,
      texto_ahorro: row?.texto_ahorro ?? null,
      cta_whatsapp_text: row?.cta_whatsapp_text?.trim() || 'Escribir por WhatsApp',
      ventana_gracia_activacion_dias: ventanaGraciaDias,
    })
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  } catch (e) {
    console.error('GET /api/config/public:', e)
    return NextResponse.json({ error: 'Error al obtener configuración pública' }, { status: 500 })
  }
}
