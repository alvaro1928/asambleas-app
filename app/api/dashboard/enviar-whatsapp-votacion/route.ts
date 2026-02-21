import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppTemplate } from '@/lib/metaWhatsapp'

const DELAY_MS = 300

/**
 * POST /api/dashboard/enviar-whatsapp-votacion
 * Envía plantilla WhatsApp a unidades (con telefono) y descuenta tokens.
 * Body: { asamblea_id, unidad_ids?: string[] }
 * Costo = cantidad_mensajes × tokens_por_mensaje_whatsapp (config Super Admin).
 */
export async function POST(request: NextRequest) {
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { asamblea_id, unidad_ids: unidadIdsParam } = body as { asamblea_id?: string; unidad_ids?: string[] }
    if (!asamblea_id) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const { data: whatsappRow } = await admin
      .from('configuracion_whatsapp')
      .select('access_token, phone_number_id, template_name, tokens_por_mensaje_whatsapp')
      .eq('key', 'default')
      .maybeSingle()

    const wa = whatsappRow as {
      access_token?: string | null
      phone_number_id?: string | null
      template_name?: string | null
      tokens_por_mensaje_whatsapp?: number | null
    } | null

    if (!wa?.access_token?.trim() || !wa?.phone_number_id?.trim() || !wa?.template_name?.trim()) {
      return NextResponse.json(
        { error: 'WhatsApp no configurado. Configura Token, Phone Number ID y nombre de plantilla en Super Admin → WhatsApp.' },
        { status: 503 }
      )
    }

    const tokensPorMensaje = Math.max(1, Math.floor(Number(wa.tokens_por_mensaje_whatsapp ?? 1)))

    const { data: asamblea, error: asambleaError } = await admin
      .from('asambleas')
      .select('id, nombre, codigo_acceso, url_publica, organization_id, fecha')
      .eq('id', asamblea_id)
      .single()

    if (asambleaError || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asamblea.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'Asamblea sin conjunto' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!profile) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (!byId) {
        return NextResponse.json({ error: 'No tienes acceso a esta asamblea' }, { status: 403 })
      }
    }

    let query = admin
      .from('unidades')
      .select('id, telefono, nombre_propietario')
      .eq('organization_id', orgId)
      .eq('is_demo', false)
      .not('telefono', 'is', null)

    const unidadIds = Array.isArray(unidadIdsParam) ? unidadIdsParam.filter(Boolean) : []
    if (unidadIds.length > 0) {
      query = query.in('id', unidadIds)
    }

    const { data: unidades } = await query

    const conTelefono = (unidades ?? []).filter((u: { telefono?: string | null }) => (u.telefono ?? '').trim().length > 0)
    if (conTelefono.length === 0) {
      return NextResponse.json(
        { error: unidadIds.length > 0 ? 'Ninguna de las unidades seleccionadas tiene teléfono.' : 'No hay unidades con teléfono en este conjunto.' },
        { status: 400 }
      )
    }

    const totalCost = conTelefono.length * tokensPorMensaje

    const { data: byUser } = await admin.from('profiles').select('tokens_disponibles').eq('user_id', session.user.id)
    const { data: byId } = await admin.from('profiles').select('tokens_disponibles').eq('id', session.user.id)
    const allTokens = [
      ...(Array.isArray(byUser) ? byUser : byUser ? [byUser] : []),
      ...(Array.isArray(byId) ? byId : byId ? [byId] : []),
    ].map((p: { tokens_disponibles?: number }) => Math.max(0, Number(p?.tokens_disponibles ?? 0)))
    const tokensActuales = allTokens.length ? Math.max(...allTokens) : 0

    if (tokensActuales < totalCost) {
      return NextResponse.json(
        {
          error: `Saldo insuficiente: se necesitan ${totalCost} tokens (${conTelefono.length} mensajes × ${tokensPorMensaje} tokens/mensaje) y tienes ${tokensActuales}.`,
          code: 'SIN_TOKENS',
          costo: totalCost,
          saldo: tokensActuales,
          mensajes: conTelefono.length,
        },
        { status: 402 }
      )
    }

    const nuevoSaldo = Math.max(0, tokensActuales - totalCost)

    const { error: updateByUser } = await admin
      .from('profiles')
      .update({ tokens_disponibles: nuevoSaldo })
      .eq('user_id', session.user.id)
    let updateError = updateByUser
    if (updateError) {
      const { error: updateById } = await admin
        .from('profiles')
        .update({ tokens_disponibles: nuevoSaldo })
        .eq('id', session.user.id)
      updateError = updateById
    }
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { data: org } = await admin.from('organizations').select('name').eq('id', orgId).single()
    const nombreConjunto = (org as { name?: string } | null)?.name ?? 'Conjunto'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.asamblea.online'
    const urlVotacion = asamblea.codigo_acceso
      ? `${siteUrl}/votar/${asamblea.codigo_acceso}`
      : (asamblea.url_publica ?? '')
    const fechaStr = asamblea.fecha
      ? new Date(asamblea.fecha).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''
    const tituloAsamblea = asamblea.nombre ?? 'Asamblea'

    const config = {
      access_token: wa.access_token.trim(),
      phone_number_id: wa.phone_number_id.trim(),
      template_name: wa.template_name.trim(),
    }

    const errores: string[] = []
    let enviados = 0

    for (let i = 0; i < conTelefono.length; i++) {
      const u = conTelefono[i] as { telefono?: string; nombre_propietario?: string | null }
      const telefono = (u.telefono ?? '').replace(/\D/g, '')
      if (!telefono) continue
      const to = telefono.length <= 10 ? `57${telefono}` : telefono

      const result = await sendWhatsAppTemplate(config, {
        to,
        param1: (u.nombre_propietario ?? 'Residente').trim() || 'Residente',
        param2: nombreConjunto,
        param3: tituloAsamblea,
        param4: fechaStr,
        param5Url: urlVotacion,
      })

      if (result.ok) {
        enviados++
      } else {
        errores.push(`${to}: ${result.error ?? 'Error'}`)
      }

      if (i < conTelefono.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS))
      }
    }

    try {
      await admin.from('billing_logs').insert({
        user_id: session.user.id,
        tipo_operacion: 'WhatsApp',
        asamblea_id,
        organization_id: orgId,
        tokens_usados: totalCost,
        saldo_restante: nuevoSaldo,
        metadata: { mensajes: conTelefono.length, enviados, tokens_por_mensaje: tokensPorMensaje },
      })
    } catch (e) {
      console.error('billing_logs insert:', e)
    }

    return NextResponse.json({
      enviados,
      total: conTelefono.length,
      tokens_descontados: totalCost,
      tokens_restantes: nuevoSaldo,
      errores: errores.length > 0 ? errores : undefined,
    })
  } catch (e) {
    console.error('enviar-whatsapp-votacion:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al enviar por WhatsApp' },
      { status: 500 }
    )
  }
}
