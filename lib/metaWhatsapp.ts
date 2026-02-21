/**
 * Envío de mensajes por WhatsApp mediante la API de Meta (Graph API).
 * Plantillas tipo marketing: variables {{1}} a {{5}} y opcional botón con URL.
 */

const META_GRAPH_BASE = 'https://graph.facebook.com/v18.0'

export interface EnvioWhatsAppParams {
  /** Número en formato internacional sin + (ej. 573143104977) */
  to: string
  /** {{1}} = Nombre del residente */
  param1: string
  /** {{2}} = Nombre del conjunto */
  param2: string
  /** {{3}} = Título asamblea/pregunta */
  param3: string
  /** {{4}} = Fecha y hora */
  param4: string
  /** URL del botón (link de votación) o {{5}} si la plantilla solo tiene cuerpo */
  param5Url: string
}

export interface ConfigWhatsApp {
  access_token: string
  phone_number_id: string
  template_name: string
}

/**
 * Envía un mensaje de plantilla a un número por la API de Meta.
 * La plantilla debe tener 5 variables de cuerpo en el orden: nombre residente, conjunto, título, fecha, (el 5º puede ser texto o URL de botón).
 */
export async function sendWhatsAppTemplate(
  config: ConfigWhatsApp,
  params: EnvioWhatsAppParams
): Promise<{ ok: boolean; error?: string }> {
  const { access_token, phone_number_id, template_name } = config
  const to = params.to.replace(/\D/g, '')
  if (!to) {
    return { ok: false, error: 'Número de teléfono vacío' }
  }

  const url = `${META_GRAPH_BASE}/${phone_number_id}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template_name,
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.param1 },
            { type: 'text', text: params.param2 },
            { type: 'text', text: params.param3 },
            { type: 'text', text: params.param4 },
            { type: 'text', text: params.param5Url },
          ],
        },
      ],
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errMsg = data?.error?.message || data?.error?.error_user_msg || res.statusText
    return { ok: false, error: errMsg }
  }
  if (data?.error) {
    return { ok: false, error: data.error.message || JSON.stringify(data.error) }
  }
  return { ok: true }
}
