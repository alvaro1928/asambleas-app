import { NextRequest, NextResponse } from 'next/server'
import { publicErrorMessage, logRouteError } from '@/lib/route-errors'
import { upsertPresenceHeartbeat } from '@/lib/quorum/presence-service'
import { recalculateQuorumAndLog } from '@/lib/quorum/quorum-service'

type PresenceHeartbeatRequest = {
  asamblea_id?: string
  identificador?: string
  connection_id?: string
  activity_hint?: boolean
  pregunta_id?: string
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as PresenceHeartbeatRequest
    const asambleaId = String(body.asamblea_id ?? '').trim()
    const identificador = String(body.identificador ?? '').trim()
    const connectionId = String(body.connection_id ?? '').trim() || null
    const preguntaId = String(body.pregunta_id ?? '').trim() || null

    if (!asambleaId || !identificador) {
      return NextResponse.json({ error: 'Faltan datos para mantener la presencia automática en quórum' }, { status: 400 })
    }

    const eventType = body.activity_hint ? 'activity' : 'heartbeat'
    const idemKey = `${asambleaId}:${identificador}:${connectionId ?? 'na'}:${eventType}:${Math.floor(Date.now() / 5000)}`

    const result = await upsertPresenceHeartbeat({
      asambleaId,
      identificador,
      connectionId,
      activityHint: Boolean(body.activity_hint),
      preguntaId,
      eventType,
      idempotencyKey: idemKey,
    })

    const quorum = await recalculateQuorumAndLog(asambleaId, {
      preguntaId,
      triggeredBy: eventType,
      idempotencyKey: `${idemKey}:recalc`,
    })

    return NextResponse.json({
      ok: true,
      presence: result,
      quorum,
    })
  } catch (error) {
    logRouteError('api/votar/presence-heartbeat', error)
    return NextResponse.json(
      { error: publicErrorMessage(error, 'No se pudo actualizar la presencia automática. Reintentando...') },
      { status: 500 }
    )
  }
}
