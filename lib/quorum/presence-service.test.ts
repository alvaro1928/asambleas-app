import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/quorum/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

import { getSupabaseAdminClient } from '@/lib/quorum/supabase-admin'
import { upsertPresenceHeartbeat } from '@/lib/quorum/presence-service'

describe('upsertPresenceHeartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ejecuta heartbeat upsert y refresca unidades', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            presence_id: 'presence-1',
            participant_key: 'participant-1',
            status: 'online',
            last_heartbeat_at: '2026-01-01T00:00:00Z',
            last_activity_at: '2026-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: 1, error: null })

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof getSupabaseAdminClient>)

    const result = await upsertPresenceHeartbeat({
      asambleaId: 'asamblea-1',
      identificador: 'alguien@correo.com',
      eventType: 'vote_cast',
    })

    expect(result.presenceId).toBe('presence-1')
    expect(result.status).toBe('online')
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenNthCalledWith(1, 'quorum_presence_heartbeat_upsert', expect.any(Object))
    expect(rpc).toHaveBeenNthCalledWith(2, 'quorum_presence_refresh_units', {
      p_asamblea_id: 'asamblea-1',
      p_identificador: 'alguien@correo.com',
    })
  })
})
