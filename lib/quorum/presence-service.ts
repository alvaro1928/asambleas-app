import { getSupabaseAdminClient } from '@/lib/quorum/supabase-admin'

export interface PresenceHeartbeatInput {
  asambleaId: string
  identificador: string
  connectionId?: string | null
  activityHint?: boolean
  preguntaId?: string | null
  eventType?: 'heartbeat' | 'activity' | 'vote_cast' | 'reconnected'
  idempotencyKey?: string | null
  authUserId?: string | null
}

export interface PresenceHeartbeatResult {
  presenceId: string
  participantKey: string
  status: 'online' | 'idle' | 'stale' | 'offline'
  lastHeartbeatAt: string
  lastActivityAt: string
}

export async function upsertPresenceHeartbeat(input: PresenceHeartbeatInput): Promise<PresenceHeartbeatResult> {
  const admin = getSupabaseAdminClient()

  const eventType = input.eventType ?? 'heartbeat'
  const activityHint = Boolean(input.activityHint || eventType === 'activity' || eventType === 'vote_cast')

  const { data, error } = await admin.rpc('quorum_presence_heartbeat_upsert', {
    p_asamblea_id: input.asambleaId,
    p_identificador: input.identificador,
    p_connection_id: input.connectionId ?? null,
    p_activity_hint: activityHint,
    p_event_type: eventType,
    p_pregunta_id: input.preguntaId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_auth_user_id: input.authUserId ?? null,
  })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : null
  if (!row) throw new Error('No se pudo actualizar presencia')

  const { error: unitsErr } = await admin.rpc('quorum_presence_refresh_units', {
    p_asamblea_id: input.asambleaId,
    p_identificador: input.identificador,
  })
  if (unitsErr) throw unitsErr

  return {
    presenceId: row.presence_id,
    participantKey: row.participant_key,
    status: row.status,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastActivityAt: row.last_activity_at,
  }
}
