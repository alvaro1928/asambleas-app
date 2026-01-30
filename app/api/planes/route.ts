import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/planes
 * Lista planes activos (nombre, key, precio_cop_anual) para mostrar en landing/dashboard.
 * Público: no requiere auth.
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
      .from('planes')
      .select('key, nombre, precio_cop_anual')
      .eq('activo', true)
      .order('precio_cop_anual', { ascending: true })

    if (error) {
      console.error('GET /api/planes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ planes: data ?? [] })
  } catch (e) {
    console.error('GET /api/planes:', e)
    return NextResponse.json({ error: 'Error al listar planes' }, { status: 500 })
  }
}
