import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

/** Prioridad: 1) SMTP en Supabase (Super Admin), 2) Resend (env), 3) SMTP (env). */
export type EmailConfig =
  | { type: 'resend'; from: string }
  | { type: 'smtp'; from: string; host: string; port: number; secure: boolean; user: string; pass: string }

export async function getEmailConfig(): Promise<EmailConfig | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false },
    })
    const { data: row } = await admin
      .from('configuracion_smtp')
      .select('host, port, secure, user, pass, from_address')
      .eq('key', 'default')
      .maybeSingle()
    const r = row as {
      host?: string
      port?: number
      secure?: boolean
      user?: string
      pass?: string
      from_address?: string
    } | null
    if (r?.host?.trim() && r?.user?.trim() && r?.pass) {
      return {
        type: 'smtp',
        from: r.from_address?.trim() || r.user?.trim() || 'Votaciones <noreply@epbco.cloud>',
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
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS
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
 * Envía un correo transaccional (Resend o SMTP según getEmailConfig).
 * @returns ok false con error 'no_config' si no hay transporte configurado.
 */
export async function sendDashboardEmail(params: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const emailConfig = await getEmailConfig()
  if (!emailConfig) {
    return { ok: false, error: 'no_config' }
  }
  const to = params.to.trim()
  if (!to) return { ok: false, error: 'destino vacío' }

  try {
    if (emailConfig.type === 'resend') {
      const resend = new Resend(process.env.RESEND_API_KEY!.trim())
      const { error } = await resend.emails.send({
        from: emailConfig.from,
        to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    }
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    })
    await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
