import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/configuracion-global
 * Devuelve la configuración de la landing (titulo, subtitulo, whatsapp_number).
 * Público: no requiere auth. La landing usa esto para textos dinámicos.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

    const { data, error } = await supabase
      .from('configuracion_global')
      .select('titulo, subtitulo, whatsapp_number, color_principal_hex')
      .eq('key', 'landing')
      .maybeSingle()

    if (error) {
      console.error('GET /api/configuracion-global:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data as { titulo?: string | null; subtitulo?: string | null; whatsapp_number?: string | null; color_principal_hex?: string | null } | null
    return NextResponse.json({
      titulo: row?.titulo ?? null,
      subtitulo: row?.subtitulo ?? null,
      whatsapp_number: row?.whatsapp_number ?? null,
      color_principal_hex: row?.color_principal_hex ?? null,
    })
  } catch (e) {
    console.error('GET /api/configuracion-global:', e)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}
