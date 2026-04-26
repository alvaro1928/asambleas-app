import { getSupabaseAdminClient } from '@/lib/quorum/supabase-admin'

export type QuorumSnapshotType =
  | 'assembly_opening'
  | 'voting_opening'
  | 'voting_closing'
  | 'quorum_change'
  | 'assembly_closing'
  | 'manual_check'

export interface SnapshotInput {
  asambleaId: string
  snapshotType: QuorumSnapshotType
  preguntaId?: string | null
  generatedByEventId?: string | null
  generatedByUser?: string | null
  metadata?: Record<string, unknown>
}

export async function createQuorumSnapshot(input: SnapshotInput): Promise<string> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.rpc('insert_quorum_snapshot', {
    p_asamblea_id: input.asambleaId,
    p_snapshot_type: input.snapshotType,
    p_pregunta_id: input.preguntaId ?? null,
    p_generated_by_event_id: input.generatedByEventId ?? null,
    p_generated_by_user: input.generatedByUser ?? null,
    p_metadata: input.metadata ?? {},
  })
  if (error) throw error
  if (!data) throw new Error('No se pudo crear snapshot de quórum')
  return String(data)
}
