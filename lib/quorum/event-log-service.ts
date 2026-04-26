import { getSupabaseAdminClient } from '@/lib/quorum/supabase-admin'

export interface QuorumEventPayload {
  asambleaId: string
  eventType:
    | 'joined'
    | 'heartbeat'
    | 'activity'
    | 'vote_cast'
    | 'stale'
    | 'offline'
    | 'reconnected'
    | 'quorum_recalculated'
    | 'quorum_lost'
    | 'quorum_recovered'
    | 'admin_override'
    | 'snapshot_created'
  participantKey?: string | null
  presenceId?: string | null
  preguntaId?: string | null
  coefficientImpacted?: string | number | null
  totalQuorumAfter?: string | number | null
  quorumPercentageAfter?: string | number | null
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
}

export async function logQuorumEvent(payload: QuorumEventPayload): Promise<void> {
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('quorum_event_log').insert({
    asamblea_id: payload.asambleaId,
    presence_id: payload.presenceId ?? null,
    participant_key: payload.participantKey ?? null,
    pregunta_id: payload.preguntaId ?? null,
    event_type: payload.eventType,
    coefficient_impacted: payload.coefficientImpacted ?? null,
    total_quorum_after: payload.totalQuorumAfter ?? null,
    quorum_percentage_after: payload.quorumPercentageAfter ?? null,
    idempotency_key: payload.idempotencyKey ?? null,
    metadata: payload.metadata ?? {},
  })

  if (error && payload.idempotencyKey) {
    // Permite reintentos idempotentes sin romper flujo crítico.
    if (error.code === '23505') return
  }
  if (error) throw error
}
