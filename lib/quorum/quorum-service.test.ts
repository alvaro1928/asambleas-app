import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/quorum/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/lib/quorum/event-log-service', () => ({
  logQuorumEvent: vi.fn(),
}))

import { getSupabaseAdminClient } from '@/lib/quorum/supabase-admin'
import { calcularQuorumPresencia } from '@/lib/quorum/quorum-service'

describe('calcularQuorumPresencia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mapea respuesta SQL a DTO tipado', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          total_unidades: 100,
          total_participantes: 30,
          participantes_activos: 25,
          participantes_delegados_activos: 5,
          active_coefficient_total: '45.5',
          delegated_coefficient_total: '12.5',
          total_represented_coefficient: '58.0',
          total_assembly_coefficient: '100.0',
          quorum_percentage: '58.0',
          quorum_met: true,
        },
      ],
      error: null,
    })

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    const result = await calcularQuorumPresencia('asamblea-1')
    expect(result.totalUnidades).toBe(100)
    expect(result.totalRepresentedCoefficient).toBe('58.0')
    expect(result.quorumMet).toBe(true)
  })
})
