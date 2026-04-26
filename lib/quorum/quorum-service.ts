import { getSupabaseAdminClient } from '@/lib/quorum/supabase-admin'
import { logQuorumEvent } from '@/lib/quorum/event-log-service'

export interface QuorumPresenceTotals {
  totalUnidades: number
  totalParticipantes: number
  participantesActivos: number
  participantesDelegadosActivos: number
  activeCoefficientTotal: string
  delegatedCoefficientTotal: string
  totalRepresentedCoefficient: string
  totalAssemblyCoefficient: string
  quorumPercentage: string
  quorumMet: boolean
}

export async function refreshPresenceStatuses(asambleaId: string): Promise<number> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.rpc('mark_presence_stale_offline_lazy', { p_asamblea_id: asambleaId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function calcularQuorumPresencia(
  asambleaId: string,
  preguntaId?: string | null
): Promise<QuorumPresenceTotals> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.rpc('calcular_quorum_presencia', {
    p_asamblea_id: asambleaId,
    p_pregunta_id: preguntaId ?? null,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : null
  if (!row) {
    return {
      totalUnidades: 0,
      totalParticipantes: 0,
      participantesActivos: 0,
      participantesDelegadosActivos: 0,
      activeCoefficientTotal: '0',
      delegatedCoefficientTotal: '0',
      totalRepresentedCoefficient: '0',
      totalAssemblyCoefficient: '0',
      quorumPercentage: '0',
      quorumMet: false,
    }
  }

  return {
    totalUnidades: Number(row.total_unidades ?? 0),
    totalParticipantes: Number(row.total_participantes ?? 0),
    participantesActivos: Number(row.participantes_activos ?? 0),
    participantesDelegadosActivos: Number(row.participantes_delegados_activos ?? 0),
    activeCoefficientTotal: String(row.active_coefficient_total ?? '0'),
    delegatedCoefficientTotal: String(row.delegated_coefficient_total ?? '0'),
    totalRepresentedCoefficient: String(row.total_represented_coefficient ?? '0'),
    totalAssemblyCoefficient: String(row.total_assembly_coefficient ?? '0'),
    quorumPercentage: String(row.quorum_percentage ?? '0'),
    quorumMet: Boolean(row.quorum_met),
  }
}

export async function recalculateQuorumAndLog(
  asambleaId: string,
  options?: {
    preguntaId?: string | null
    triggeredBy?: string
    idempotencyKey?: string | null
  }
): Promise<QuorumPresenceTotals> {
  await refreshPresenceStatuses(asambleaId)
  const totals = await calcularQuorumPresencia(asambleaId, options?.preguntaId)
  await logQuorumEvent({
    asambleaId,
    eventType: 'quorum_recalculated',
    preguntaId: options?.preguntaId ?? null,
    totalQuorumAfter: totals.totalRepresentedCoefficient,
    quorumPercentageAfter: totals.quorumPercentage,
    idempotencyKey: options?.idempotencyKey ?? null,
    metadata: {
      triggeredBy: options?.triggeredBy ?? 'system',
      quorumMet: totals.quorumMet,
    },
  })
  return totals
}
