import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, isAdminEmail } from '@/lib/super-admin'

function canAccessSuperAdmin(email: string | undefined): boolean {
  return isSuperAdmin(email) || isAdminEmail(email)
}

/** GET: devuelve la configuración de landing (titulo, subtitulo, whatsapp_number) para editar en Super Admin */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!canAccessSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data, error } = await admin
      .from('configuracion_global')
      .select('id, key, titulo, subtitulo, whatsapp_number, color_principal_hex, precio_por_token_cop, bono_bienvenida_tokens, texto_hero_precio, texto_ahorro, cta_whatsapp_text')
      .eq('key', 'landing')
      .maybeSingle()

    if (error) {
      console.error('super-admin configuracion-landing GET:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data as {
      id?: string
      key?: string
      titulo?: string | null
      subtitulo?: string | null
      whatsapp_number?: string | null
      color_principal_hex?: string | null
      precio_por_token_cop?: number | null
      bono_bienvenida_tokens?: number | null
      texto_hero_precio?: string | null
      texto_ahorro?: string | null
      cta_whatsapp_text?: string | null
    } | null

    return NextResponse.json({
      id: row?.id ?? null,
      key: row?.key ?? 'landing',
      titulo: row?.titulo ?? '',
      subtitulo: row?.subtitulo ?? '',
      whatsapp_number: row?.whatsapp_number ?? '',
      color_principal_hex: row?.color_principal_hex ?? '',
      precio_por_token_cop: row?.precio_por_token_cop != null ? Number(row.precio_por_token_cop) : null,
      bono_bienvenida_tokens: row?.bono_bienvenida_tokens != null ? Number(row.bono_bienvenida_tokens) : null,
      texto_hero_precio: row?.texto_hero_precio ?? '',
      texto_ahorro: row?.texto_ahorro ?? '',
      cta_whatsapp_text: row?.cta_whatsapp_text?.trim() || 'Contactanos',
    })
  } catch (e) {
    console.error('super-admin configuracion-landing GET:', e)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

/** PATCH: actualiza titulo, subtitulo, whatsapp_number de la landing */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!canAccessSuperAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { titulo, subtitulo, whatsapp_number, color_principal_hex, precio_por_token_cop, bono_bienvenida_tokens, texto_hero_precio, texto_ahorro, cta_whatsapp_text } = body as {
      titulo?: string
      subtitulo?: string
      whatsapp_number?: string
      color_principal_hex?: string
      precio_por_token_cop?: number
      bono_bienvenida_tokens?: number
      texto_hero_precio?: string
      texto_ahorro?: string
      cta_whatsapp_text?: string
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const updates: Record<string, string | number | null> = {}
    if (titulo !== undefined) updates.titulo = typeof titulo === 'string' ? titulo : null
    if (subtitulo !== undefined) updates.subtitulo = typeof subtitulo === 'string' ? subtitulo : null
    if (whatsapp_number !== undefined) updates.whatsapp_number = typeof whatsapp_number === 'string' ? whatsapp_number : null
    if (color_principal_hex !== undefined) updates.color_principal_hex = typeof color_principal_hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color_principal_hex) ? color_principal_hex : null
    if (precio_por_token_cop !== undefined) updates.precio_por_token_cop = typeof precio_por_token_cop === 'number' && precio_por_token_cop >= 0 ? precio_por_token_cop : null
    if (bono_bienvenida_tokens !== undefined) updates.bono_bienvenida_tokens = typeof bono_bienvenida_tokens === 'number' && bono_bienvenida_tokens >= 0 ? bono_bienvenida_tokens : null
    if (texto_hero_precio !== undefined) updates.texto_hero_precio = typeof texto_hero_precio === 'string' ? texto_hero_precio : null
    if (texto_ahorro !== undefined) updates.texto_ahorro = typeof texto_ahorro === 'string' ? texto_ahorro : null
    if (cta_whatsapp_text !== undefined) updates.cta_whatsapp_text = typeof cta_whatsapp_text === 'string' ? (cta_whatsapp_text.trim() || 'Contactanos') : null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Falta al menos un campo para actualizar' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: existing } = await admin
      .from('configuracion_global')
      .select('id')
      .eq('key', 'landing')
      .maybeSingle()

    if (!existing) {
      const { data: inserted, error: insertErr } = await admin
        .from('configuracion_global')
        .insert({
          key: 'landing',
          titulo: updates.titulo ?? null,
          subtitulo: updates.subtitulo ?? null,
          whatsapp_number: updates.whatsapp_number ?? null,
          color_principal_hex: updates.color_principal_hex ?? null,
          precio_por_token_cop: updates.precio_por_token_cop ?? null,
          bono_bienvenida_tokens: updates.bono_bienvenida_tokens ?? null,
          texto_hero_precio: updates.texto_hero_precio ?? null,
          texto_ahorro: updates.texto_ahorro ?? null,
          cta_whatsapp_text: updates.cta_whatsapp_text ?? 'Contactanos',
        })
        .select()
        .single()
      if (insertErr) {
        console.error('super-admin configuracion-landing INSERT:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
      return NextResponse.json(inserted)
    }

    const { data: updated, error } = await admin
      .from('configuracion_global')
      .update(updates as Record<string, unknown>)
      .eq('key', 'landing')
      .select()
      .single()

    if (error) {
      console.error('super-admin configuracion-landing PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (e) {
    console.error('super-admin configuracion-landing PATCH:', e)
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 })
  }
}
