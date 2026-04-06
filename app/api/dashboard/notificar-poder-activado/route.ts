import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { sendDashboardEmail } from '@/lib/dashboard-email'

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function esCorreoValido(s: string | null | undefined): boolean {
  return !!(s && RE_EMAIL.test(String(s).trim()))
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * POST /api/dashboard/notificar-poder-activado
 * Tras aprobar un poder (estado activo), avisa por correo a otorgante y/o receptor si hay dirección válida.
 * Apoderado sin unidad en copropiedad (tercero/externo): recuerda ingreso con celular o documento registrado.
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

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const poderId = String((body as { poder_id?: string }).poder_id ?? '').trim()
    if (!poderId) {
      return NextResponse.json({ error: 'Falta poder_id' }, { status: 400 })
    }

    const { data: poder, error: pErr } = await supabase
      .from('vista_poderes_completa')
      .select('*')
      .eq('id', poderId)
      .maybeSingle()

    if (pErr || !poder) {
      return NextResponse.json({ error: 'Poder no encontrado' }, { status: 404 })
    }

    const row = poder as {
      estado?: string
      asamblea_id?: string
      unidad_receptor_id?: string | null
      email_otorgante?: string | null
      email_receptor?: string | null
      nombre_otorgante?: string | null
      nombre_receptor?: string | null
      unidad_otorgante_torre?: string | null
      unidad_otorgante_numero?: string | null
      asamblea_nombre?: string | null
    }

    if (row.estado !== 'activo') {
      return NextResponse.json({ error: 'El poder no está activo' }, { status: 400 })
    }

    const { data: asamblea, error: aErr } = await supabase
      .from('asambleas')
      .select('id, codigo_acceso, organization_id, nombre')
      .eq('id', row.asamblea_id as string)
      .single()

    if (aErr || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asamblea.organization_id as string
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.asamblea.online'
    const codigoAcceso = asamblea.codigo_acceso as string | null
    const urlVotacion = codigoAcceso ? `${siteUrl}/votar/${codigoAcceso}` : siteUrl

    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
    const nombreConjunto = String((org as { name?: string } | null)?.name ?? 'Copropiedad').trim() || 'Copropiedad'

    const unidadOtorganteTxt = `${row.unidad_otorgante_torre || 'S/T'} — ${row.unidad_otorgante_numero || 'S/N'}`
    const nombreAsamblea = String(row.asamblea_nombre ?? (asamblea as { nombre?: string }).nombre ?? 'Asamblea')
    const esApoderadoSinUnidad = !row.unidad_receptor_id

    const ot = esCorreoValido(row.email_otorgante) ? String(row.email_otorgante).trim().toLowerCase() : null
    const rec = esCorreoValido(row.email_receptor) ? String(row.email_receptor).trim().toLowerCase() : null

    const textoTerceroPlain = esApoderadoSinUnidad
      ? `

Importante — cómo ingresar a votar:
Como apoderado no registrado en la copropiedad, debes usar en la pantalla de acceso el mismo número de celular o documento (cédula) que registraste al solicitar el poder. Debe coincidir exactamente (mismo formato: si usas solo dígitos del celular, sin espacios ni guiones).
`
      : `

Para ingresar a votar usa el mismo correo electrónico o teléfono asociado a tu unidad en esta copropiedad, o el identificador con el que te registraron como apoderado receptor.
`

    const htmlTercero = esApoderadoSinUnidad
      ? `<p style="margin-top:1rem;padding:0.75rem;background:#fef3c7;border-radius:8px;border:1px solid #fcd34d;color:#1f2937;"><strong>Importante — cómo ingresar a votar:</strong> usa el mismo <strong>celular o cédula</strong> que registraste al solicitar el poder. Debe coincidir exactamente (celular: solo dígitos, sin espacios).</p>`
      : `<p style="margin-top:1rem;color:#374151;">Para votar, usa el mismo correo o teléfono registrado en tu unidad o el identificador del apoderado.</p>`

    let enviados = 0
    const errores: string[] = []

    const nombreRec = String(row.nombre_receptor ?? '').trim() || '—'
    const nombreOtor = String(row.nombre_otorgante ?? '').trim() || '—'

    if (ot && rec && ot === rec) {
      const subject = `Poder aprobado — ${nombreAsamblea}`
      const text = `Hola,

La delegación de voto quedó verificada y activa para la votación.

Asamblea: ${nombreAsamblea}
Copropiedad: ${nombreConjunto}
Unidad que delega: ${unidadOtorganteTxt}
Apoderado receptor: ${nombreRec}

Enlace para votar:
${urlVotacion}
${textoTerceroPlain}
`
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:1rem;">
<h2 style="color:#4338ca;">Poder aprobado</h2>
<p>La delegación de voto quedó <strong>verificada y activa</strong>.</p>
<p><strong>Asamblea:</strong> ${esc(nombreAsamblea)}<br/><strong>Copropiedad:</strong> ${esc(nombreConjunto)}<br/><strong>Unidad que delega:</strong> ${esc(unidadOtorganteTxt)}<br/><strong>Apoderado:</strong> ${esc(nombreRec)}</p>
<p><a href="${esc(urlVotacion)}" style="display:inline-block;background:#4f46e5;color:white;padding:0.75rem 1.5rem;text-decoration:none;border-radius:8px;">Ir a votar</a></p>
${htmlTercero}
</body></html>`

      const r = await sendDashboardEmail({ to: ot, subject, text, html })
      if (r.ok) enviados++
      else if (r.error === 'no_config') {
        return NextResponse.json({
          ok: true,
          enviados: 0,
          aviso: 'Correo no configurado en el servidor; el poder sigue activo.',
        })
      } else errores.push(r.error)
    } else {
      if (ot) {
        const subject = `Delegación de voto verificada — ${nombreAsamblea}`
        const text = `Hola,

La delegación de voto que otorgaste desde la unidad ${unidadOtorganteTxt} hacia ${nombreRec} fue verificada y está activa para la asamblea «${nombreAsamblea}» (${nombreConjunto}).

El apoderado podrá votar cuando corresponda, según los datos registrados.

Enlace de la votación (para compartir si lo deseas):
${urlVotacion}
`
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:1rem;">
<h2 style="color:#4338ca;">Delegación verificada</h2>
<p>La delegación desde la unidad <strong>${esc(unidadOtorganteTxt)}</strong> hacia <strong>${esc(nombreRec)}</strong> quedó <strong>activa</strong>.</p>
<p><strong>Asamblea:</strong> ${esc(nombreAsamblea)} · ${esc(nombreConjunto)}</p>
<p><a href="${esc(urlVotacion)}" style="display:inline-block;background:#4f46e5;color:white;padding:0.75rem 1.5rem;text-decoration:none;border-radius:8px;">Abrir votación</a></p>
</body></html>`
        const r = await sendDashboardEmail({ to: ot, subject, text, html })
        if (r.ok) enviados++
        else if (r.error === 'no_config') {
          return NextResponse.json({
            ok: true,
            enviados: 0,
            aviso: 'Correo no configurado en el servidor; el poder sigue activo.',
          })
        } else errores.push(`Otorgante: ${r.error}`)
      }
      if (rec && (!ot || rec !== ot)) {
        const subject = `Tu poder fue aprobado — ${nombreAsamblea}`
        const text = `Hola${nombreRec !== '—' ? ` ${nombreRec}` : ''},

Tu poder recibido desde la unidad ${unidadOtorganteTxt} fue verificado por la administración y ya está activo para la votación «${nombreAsamblea}» (${nombreConjunto}).

Enlace para votar:
${urlVotacion}
${textoTerceroPlain}
`
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:1rem;">
<h2 style="color:#4338ca;">Poder aprobado</h2>
<p>Hola${nombreRec !== '—' ? ` <strong>${esc(nombreRec)}</strong>` : ''},</p>
<p>El poder recibido desde la unidad <strong>${esc(unidadOtorganteTxt)}</strong> fue <strong>verificado</strong> y ya puedes participar en la votación.</p>
<p><strong>Asamblea:</strong> ${esc(nombreAsamblea)} · ${esc(nombreConjunto)}</p>
<p><a href="${esc(urlVotacion)}" style="display:inline-block;background:#4f46e5;color:white;padding:0.75rem 1.5rem;text-decoration:none;border-radius:8px;">Ir a votar</a></p>
${htmlTercero}
</body></html>`
        const r = await sendDashboardEmail({ to: rec, subject, text, html })
        if (r.ok) enviados++
        else if (r.error === 'no_config') {
          return NextResponse.json({
            ok: true,
            enviados: 0,
            aviso: 'Correo no configurado en el servidor; el poder sigue activo.',
          })
        } else errores.push(`Receptor: ${r.error}`)
      }
    }

    if (!ot && !rec) {
      return NextResponse.json({
        ok: true,
        enviados: 0,
        aviso:
          'No hay direcciones de correo válidas para notificar (el contacto del otorgante o apoderado no es un email). El poder sigue activo.',
      })
    }

    return NextResponse.json({
      ok: true,
      enviados,
      errores: errores.length ? errores : undefined,
    })
  } catch (e) {
    console.error('[notificar-poder-activado]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al enviar notificaciones' },
      { status: 500 }
    )
  }
}
