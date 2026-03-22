import { NextResponse } from 'next/server'
import { logRouteError, publicErrorMessage } from '@/lib/route-errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pagos/webhook-status
 * Diagnóstico: indica si las variables necesarias para el webhook están configuradas.
 * No expone valores, solo si están definidas. Útil para comprobar por qué no llegan pagos/tokens.
 */
export async function GET() {
  try {
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET || process.env.WEBHOOK_PAGOS_SECRET
    const privateKey = process.env.WOMPI_PRIVATE_KEY
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

    return NextResponse.json({
      webhook_ok: !!(eventsSecret && (privateKey?.startsWith('prv_') || true) && serviceRole),
      events_secret_set: !!eventsSecret,
      private_key_set: !!(privateKey && privateKey.startsWith('prv_')),
      supabase_service_role_set: !!serviceRole,
      hint: 'Si todo es true y no ves pagos: en Vercel Logs busca [webhook pagos] tras un pago de prueba. URL de Eventos en Wompi debe ser https://tu-dominio/api/pagos/webhook',
    })
  } catch (e) {
    logRouteError('api/pagos/webhook-status', e)
    return NextResponse.json(
      { error: publicErrorMessage(e, 'No se pudo comprobar la configuración del webhook') },
      { status: 500 }
    )
  }
}
