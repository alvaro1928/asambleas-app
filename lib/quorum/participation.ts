import { upsertPresenceHeartbeat } from '@/lib/quorum/presence-service'
import { recalculateQuorumAndLog } from '@/lib/quorum/quorum-service'

interface VoteParticipationInput {
  asambleaId: string
  identificador: string
  preguntaId: string
  connectionId?: string | null
  idempotencyKey?: string | null
}

export async function markPresenceOnVote(input: VoteParticipationInput): Promise<void> {
  await upsertPresenceHeartbeat({
    asambleaId: input.asambleaId,
    identificador: input.identificador,
    connectionId: input.connectionId ?? null,
    preguntaId: input.preguntaId,
    eventType: 'vote_cast',
    activityHint: true,
    idempotencyKey: input.idempotencyKey ?? null,
  })

  await recalculateQuorumAndLog(input.asambleaId, {
    preguntaId: input.preguntaId,
    triggeredBy: 'vote_cast',
    idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:recalc` : null,
  })
}
