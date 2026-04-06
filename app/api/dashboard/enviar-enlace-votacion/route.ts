import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { shouldUseDemoUnits } from '@/lib/demo-sandbox'
import { getEmailConfig } from '@/lib/dashboard-email'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

/**
 * POST /api/dashboard/enviar-enlace-votacion
 * Envía por correo el enlace de votación.
 * Configuración (prioridad): 1) SMTP en Supabase (Super Admin → Ajustes), 2) Resend (env), 3) SMTP (env).
 */
export async function POST(request: NextRequest) {
  try {
    const emailConfig = await getEmailConfig()
    if (!emailConfig) {
      return NextResponse.json(
        {
          error:
            'Envío por correo no configurado. Configura SMTP en Super Admin → Ajustes, o añade en el servidor RESEND_API_KEY+RESEND_FROM o SMTP_HOST+SMTP_USER+SMTP_PASS.',
        },
        { status: 503 }
      )
    }

    const fromAddress = emailConfig.from

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
    const {
      asamblea_id,
      emails: emailsParam,
      emails_adicionales: emailsAdicionalesParam,
      enlace_tipo: enlaceTipoParam,
    } = body as {
      asamblea_id?: string
      emails?: string[]
      emails_adicionales?: string[]
      /** 'registro_poderes' = enlace /registrar-poder/[codigo] */
      enlace_tipo?: string
    }
    const enlaceTipo = enlaceTipoParam === 'registro_poderes' ? 'registro_poderes' : 'votacion'
    if (!asamblea_id) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
    }

    const { data: asamblea, error: asambleaError } = await supabase
      .from('asambleas')
      .select(
        'id, nombre, codigo_acceso, url_publica, organization_id, fecha, is_demo, sandbox_usar_unidades_reales, registro_poderes_publico'
      )
      .eq('id', asamblea_id)
      .single()

    if (asambleaError || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asamblea.organization_id
    const asambleaRow = asamblea as { is_demo?: boolean; sandbox_usar_unidades_reales?: boolean }
    const soloUnidadesDemo = shouldUseDemoUnits(asambleaRow?.is_demo, asambleaRow?.sandbox_usar_unidades_reales)
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

    let queryUnidades = supabase
      .from('unidades')
      .select('id, email_propietario, email, torre, numero')
      .eq('organization_id', orgId)
    queryUnidades = soloUnidadesDemo ? queryUnidades.eq('is_demo', true) : queryUnidades.or('is_demo.eq.false,is_demo.is.null')
    const { data: unidades } = await queryUnidades

    const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const splitEmails = (raw: string | null | undefined): string[] => {
      if (!raw || typeof raw !== 'string') return []
      return raw
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && reEmail.test(s))
    }
    const todosEmailsSet = new Set<string>()
    for (const u of unidades ?? []) {
      const raw = (u as { email_propietario?: string | null; email?: string | null }).email_propietario ?? (u as { email?: string | null }).email
      for (const e of splitEmails(raw)) todosEmailsSet.add(e)
    }
    const todosEmails = Array.from(todosEmailsSet)

    const todosEmailsLower = new Set(todosEmails.map((e) => e.toLowerCase()))
    const emailsRegistrados =
      emailsParam === undefined
        ? todosEmails
        : Array.isArray(emailsParam)
          ? Array.from(new Set(emailsParam.flatMap((e) => splitEmails(e && String(e))).filter((e) => todosEmailsLower.has(e))))
          : []

    const adicionales = Array.isArray(emailsAdicionalesParam)
      ? emailsAdicionalesParam
          .map((e) => (e && String(e).trim()).toLowerCase())
          .filter((e) => e && reEmail.test(e))
      : []
    const emailsSet = new Set<string>([...emailsRegistrados, ...adicionales])
    const emails = Array.from(emailsSet)

    if (emails.length === 0) {
      return NextResponse.json(
        {
          error:
            Array.isArray(emailsParam) && emailsParam.length > 0
              ? 'Ninguno de los correos pertenece a este conjunto.'
              : Array.isArray(emailsAdicionalesParam) && emailsAdicionalesParam.length > 0
                ? 'Ingresa al menos un correo válido.'
                : 'No hay unidades con correo registrado en este conjunto.',
        },
        { status: 400 }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.asamblea.online'
    const codigo = asamblea.codigo_acceso ? String(asamblea.codigo_acceso).trim() : ''
    const urlVotacion =
      codigo && enlaceTipo === 'registro_poderes'
        ? `${siteUrl}/registrar-poder/${codigo}`
        : codigo
          ? `${siteUrl}/votar/${codigo}`
          : (asamblea.url_publica ?? '')
    /** Mismo código: portal para declarar/cargar poderes (solo si está habilitado en la asamblea). */
    const urlRegistroPoderes = codigo ? `${siteUrl}/registrar-poder/${codigo}` : ''
    const registroPoderesHabilitado = !!(asamblea as { registro_poderes_publico?: boolean }).registro_poderes_publico
    const incluirLinkRegistroEnCorreoVotacion =
      enlaceTipo === 'votacion' && !!codigo && registroPoderesHabilitado && !!urlRegistroPoderes
    const fechaStr = asamblea.fecha
      ? new Date(asamblea.fecha).toLocaleString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Bogota',
        })
      : ''

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()
    const nombreConjunto = ((org as { name?: string } | null)?.name ?? 'Conjunto').trim() || 'Conjunto'

    const { data: configPoderes } = await supabase
      .from('configuracion_poderes')
      .select('plantilla_adicional_correo, plantilla_mensaje_invitacion')
      .eq('organization_id', orgId)
      .maybeSingle()
    const textoAdicional = (configPoderes as { plantilla_adicional_correo?: string | null } | null)?.plantilla_adicional_correo?.trim() || ''
    const plantillaMensaje = (configPoderes as { plantilla_mensaje_invitacion?: string | null } | null)?.plantilla_mensaje_invitacion?.trim() || ''
    const bloqueAdicionalTexto = textoAdicional ? `\n\n${textoAdicional}\n\n` : '\n\n'
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const bloqueAdicionalHtml = textoAdicional
      ? `<p style="margin: 1rem 0; padding: 0.75rem; background: #f3f4f6; border-radius: 8px;">${esc(textoAdicional).replace(/\n/g, '<br>')}</p>`
      : ''

    const defaultTemplateVotacion = `🗳️ VOTACION VIRTUAL ACTIVA

Asamblea: {asamblea}
Conjunto: {conjunto}
Fecha: {fecha}

👉 Vota aqui:
{url}

{bloque_registro_poderes}

⚠️ Necesitas tu email registrado en el conjunto.

Tu participacion es importante. 🏠`

    const defaultTemplateRegistroPoder = `📋 REGISTRO DE PODERES

Asamblea: {asamblea}
Conjunto: {conjunto}
Fecha: {fecha}

👉 Declara o carga aquí los poderes (pendientes de aprobación):
{url}

⚠️ Usa el mismo email o teléfono registrado en tu unidad.

Gracias. 🏠`
    const bloqueRegistroPoderesTexto =
      incluirLinkRegistroEnCorreoVotacion && urlRegistroPoderes
        ? `📋 Registro o carga de poderes (pendiente de aprobación):
${urlRegistroPoderes}

`
        : ''

    const renderPlantilla = (tplRaw: string): string =>
      tplRaw
        .replace(/\{asamblea\}/gi, String(asamblea.nombre ?? 'Asamblea'))
        .replace(/\{fecha\}/gi, fechaStr)
        .replace(/\{url\}/gi, urlVotacion)
        .replace(/\{url_registro_poderes\}/gi, incluirLinkRegistroEnCorreoVotacion ? urlRegistroPoderes : '')
        .replace(/\{bloque_registro_poderes\}/gi, bloqueRegistroPoderesTexto)

    const subject =
      enlaceTipo === 'registro_poderes'
        ? `Registro de poderes: ${asamblea.nombre ?? 'Asamblea'}`
        : `Votación: ${asamblea.nombre ?? 'Asamblea'}`
    const defaultPlantilla =
      enlaceTipo === 'registro_poderes' ? defaultTemplateRegistroPoder : defaultTemplateVotacion
    let textBase = renderPlantilla(plantillaMensaje || defaultPlantilla)
    if (incluirLinkRegistroEnCorreoVotacion && urlRegistroPoderes) {
      const tplCustom = plantillaMensaje?.trim()
      const tienePlaceholderRegistro =
        !!tplCustom && /\{url_registro_poderes\}|\{bloque_registro_poderes\}/i.test(tplCustom)
      if (tplCustom && !tienePlaceholderRegistro) {
        textBase += `\n\n📋 Registro o carga de poderes (pendiente de aprobación):\n${urlRegistroPoderes}`
      }
    }
    const textBody = `${textBase}${bloqueAdicionalTexto}`
    const htmlBase = esc(textBase).replace(/\n/g, '<br>')
    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 1rem;">
  <h2 style="color: #4338ca;">${enlaceTipo === 'registro_poderes' ? 'Registro de poderes' : 'Votacion virtual activa'}</h2>
  <p style="line-height:1.6;">${htmlBase}</p>
  <p><a href="${urlVotacion}" style="display: inline-block; background: #4f46e5; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 8px;">${enlaceTipo === 'registro_poderes' ? '👉 Ir al registro de poderes' : '👉 Ir a votar'}</a></p>
  ${
    enlaceTipo === 'votacion' && incluirLinkRegistroEnCorreoVotacion && urlRegistroPoderes
      ? `<p><a href="${urlRegistroPoderes}" style="display: inline-block; background: #0f766e; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 8px;">📋 Registro o carga de poderes</a></p>`
      : ''
  }
  ${bloqueAdicionalHtml}
</body>
</html>`

    const errores: string[] = []
    let enviados = 0

    if (emailConfig.type === 'resend') {
      const resend = new Resend(process.env.RESEND_API_KEY!.trim())
      for (const to of emails) {
        const { error } = await resend.emails.send({
          from: fromAddress,
          to: to.trim(),
          subject,
          text: textBody,
          html: htmlBody,
        })
        if (error) {
          errores.push(`${to}: ${error.message}`)
        } else {
          enviados++
        }
      }
    } else {
      const transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass,
        },
      })
      for (const to of emails) {
        try {
          await transporter.sendMail({
            from: fromAddress,
            to: to.trim(),
            subject,
            text: textBody,
            html: htmlBody,
          })
          enviados++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errores.push(`${to}: ${msg}`)
        }
      }
    }

    return NextResponse.json({
      enviados,
      total: emails.length,
      errores: errores.length > 0 ? errores : undefined,
    })
  } catch (e) {
    console.error('enviar-enlace-votacion:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al enviar los correos' },
      { status: 500 }
    )
  }
}
