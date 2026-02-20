import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

/** Prioridad: 1) SMTP en Supabase (Super Admin), 2) Resend (env), 3) SMTP (env). */
type EmailConfig =
  | { type: 'resend'; from: string }
  | { type: 'smtp'; from: string; host: string; port: number; secure: boolean; user: string; pass: string }

async function getEmailConfig(): Promise<EmailConfig | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )
    const { data: row } = await admin
      .from('configuracion_smtp')
      .select('host, port, secure, user, pass, from_address')
      .eq('key', 'default')
      .maybeSingle()
    const r = row as { host?: string; port?: number; secure?: boolean; user?: string; pass?: string; from_address?: string } | null
    if (r?.host?.trim() && r?.user?.trim() && r?.pass) {
      return {
        type: 'smtp',
        from: (r.from_address?.trim() || r.user?.trim()) || 'Votaciones <noreply@epbco.cloud>',
        host: r.host.trim(),
        port: typeof r.port === 'number' && r.port > 0 ? r.port : 465,
        secure: r.secure !== false,
        user: r.user.trim(),
        pass: r.pass,
      }
    }
  }
  const useResend = process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim()
  if (useResend) {
    return { type: 'resend', from: process.env.RESEND_FROM!.trim() }
  }
  const useSmtp =
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS
  if (useSmtp) {
    const port = parseInt(process.env.SMTP_PORT || '465', 10)
    return {
      type: 'smtp',
      from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'Votaciones <noreply@epbco.cloud>',
      host: process.env.SMTP_HOST!.trim(),
      port: isNaN(port) ? 465 : port,
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!,
    }
  }
  return null
}

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
    const { asamblea_id, emails: emailsParam } = body as { asamblea_id?: string; emails?: string[] }
    if (!asamblea_id) {
      return NextResponse.json({ error: 'Falta asamblea_id' }, { status: 400 })
    }

    const { data: asamblea, error: asambleaError } = await supabase
      .from('asambleas')
      .select('id, nombre, codigo_acceso, url_publica, organization_id, fecha')
      .eq('id', asamblea_id)
      .single()

    if (asambleaError || !asamblea) {
      return NextResponse.json({ error: 'Asamblea no encontrada' }, { status: 404 })
    }

    const orgId = asamblea.organization_id
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

    const { data: unidades } = await supabase
      .from('unidades')
      .select('id, email_propietario, email, torre, numero')
      .eq('organization_id', orgId)

    const todosEmails: string[] = []
    for (const u of unidades ?? []) {
      const e = (u.email_propietario ?? u.email)?.trim()
      if (e && !todosEmails.includes(e)) todosEmails.push(e)
    }

    const emails =
      Array.isArray(emailsParam) && emailsParam.length > 0
        ? emailsParam
            .map((e) => (e && String(e).trim()).toLowerCase())
            .filter((e) => e && todosEmails.some((t) => t.toLowerCase() === e))
        : todosEmails

    if (emails.length === 0) {
      return NextResponse.json(
        {
          error:
            Array.isArray(emailsParam) && emailsParam.length > 0
              ? 'Ninguno de los correos pertenece a este conjunto.'
              : 'No hay unidades con correo registrado en este conjunto.',
        },
        { status: 400 }
      )
    }

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
    const subject = `Votación: ${asamblea.nombre ?? 'Asamblea'}`
    const textBody = `🗳️ VOTACIÓN VIRTUAL ACTIVA

📋 ${asamblea.nombre ?? 'Asamblea'}
📅 ${fechaStr}

👉 Vota aquí:
${urlVotacion}

⚠️ Necesitas tu email registrado en el conjunto

¡Tu participación es importante! 🏠`
    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 1rem;">
  <h2 style="color: #4338ca;">🗳️ Votación virtual activa</h2>
  <p><strong>${asamblea.nombre ?? 'Asamblea'}</strong></p>
  <p>📅 ${fechaStr}</p>
  <p><a href="${urlVotacion}" style="display: inline-block; background: #4f46e5; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 8px;">👉 Ir a votar</a></p>
  <p style="color: #6b7280; font-size: 0.9rem;">Necesitas tu email registrado en el conjunto.</p>
  <p>¡Tu participación es importante! 🏠</p>
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
