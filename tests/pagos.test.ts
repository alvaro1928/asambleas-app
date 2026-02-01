/**
 * Tests del webhook de pagos (modelo Billetera de Tokens por Gestor).
 * Verifica: validación de firma SHA256 (WEBHOOK_PAGOS_SECRET), idempotencia,
 * recarga de billetera del gestor y registro en pagos_log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

const TEST_SECRET = 'test-webhook-secret'
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const TEST_TX_ID = 'wompi-tx-123'
const TEST_REFERENCE = `REF_${TEST_USER_ID}_1234567890`

function buildWompiChecksum(
  data: { transaction: { id: string; reference: string; status: string } },
  timestamp: number,
  secret: string
): string {
  const props = ['transaction.id', 'transaction.reference', 'transaction.status']
  const parts: (string | number)[] = []
  for (const path of props) {
    const keys = path.split('.')
    let current: unknown = data
    for (const key of keys) {
      if (current != null && typeof current === 'object') current = (current as Record<string, unknown>)[key]
    }
    if (current !== null && current !== undefined) parts.push(String(current))
  }
  parts.push(timestamp)
  const concatenated = parts.join('') + secret
  return createHash('sha256').update(concatenated, 'utf8').digest('hex')
}

function buildApprovedPayload(amountInCents: number) {
  const timestamp = 1700000000
  const data = {
    transaction: {
      id: TEST_TX_ID,
      reference: TEST_REFERENCE,
      status: 'APPROVED',
      amount_in_cents: amountInCents,
      currency: 'COP',
    },
  }
  const checksum = buildWompiChecksum(data, timestamp, TEST_SECRET)
  return {
    event: 'transaction.updated',
    data,
    signature: {
      properties: ['transaction.id', 'transaction.reference', 'transaction.status'],
      timestamp,
      checksum,
    },
    sent_at: new Date().toISOString(),
  }
}

const mockRegistrarTransaccionPago = vi.fn<[], Promise<{ error: Error | null }>>().mockResolvedValue({ error: null })

const createChain = (config: {
  maybeSingleData?: unknown
  selectEqData?: unknown
  updateError?: Error | null
}) => {
  const chain: Record<string, unknown> = {
    select: vi.fn(function (this: Record<string, unknown>) {
      return this
    }),
    eq: vi.fn(function (this: Record<string, unknown>) {
      return this
    }),
    limit: vi.fn(function (this: Record<string, unknown>) {
      return this
    }),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: config.maybeSingleData ?? null,
        error: null,
      })
    ),
    update: vi.fn(function (this: Record<string, unknown>) {
      return {
        eq: vi.fn(() =>
          Promise.resolve({
            error: config.updateError ?? null,
          })
        ),
      }
    }),
  }
  if (config.selectEqData !== undefined) {
    chain.then = (resolve: (v: unknown) => void) => {
      resolve({ data: config.selectEqData, error: null })
    }
  }
  return chain
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'pagos_log') {
    return createChain({ maybeSingleData: null })
  }
  if (table === 'planes') {
    return createChain({ maybeSingleData: { precio_por_asamblea_cop: 10000 } })
  }
  if (table === 'profiles') {
    return createChain({
      maybeSingleData: null,
      selectEqData: [{ tokens_disponibles: 50, organization_id: 'org-123' }],
      updateError: null,
    })
  }
  return createChain({})
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/super-admin', () => ({
  registrarTransaccionPago: (...args: unknown[]) => mockRegistrarTransaccionPago(...(args as [])),
}))

describe('POST /api/pagos/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegistrarTransaccionPago.mockResolvedValue({ error: null })
    process.env.WEBHOOK_PAGOS_SECRET = TEST_SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  it('rechaza petición sin WEBHOOK_PAGOS_SECRET', async () => {
    const orig = process.env.WEBHOOK_PAGOS_SECRET
    delete process.env.WEBHOOK_PAGOS_SECRET
    const { POST } = await import('@/app/api/pagos/webhook/route')
    const req = new Request('http://localhost/api/pagos/webhook', {
      method: 'POST',
      body: JSON.stringify(buildApprovedPayload(10000)),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as import('next/server').NextRequest)
    process.env.WEBHOOK_PAGOS_SECRET = orig
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/WEBHOOK_PAGOS_SECRET/)
  })

  it('rechaza firma inválida con 401', async () => {
    const { POST } = await import('@/app/api/pagos/webhook/route')
    const payload = buildApprovedPayload(10000)
    ;(payload.signature as { checksum: string }).checksum = 'invalid-checksum'
    const req = new Request('http://localhost/api/pagos/webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as import('next/server').NextRequest)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/Firma|integridad/i)
  })

  it('con firma válida y monto correcto: aumenta tokens del gestor y registra en pagos_log', async () => {
    const { POST } = await import('@/app/api/pagos/webhook/route')
    const payload = buildApprovedPayload(10000)
    const req = new Request('http://localhost/api/pagos/webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.user_id).toBe(TEST_USER_ID)
    expect(json.tokens_disponibles).toBe(51)
    expect(json.tokens_comprados).toBe(1)
    expect(mockRegistrarTransaccionPago).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organization_id: 'org-123',
        monto: 10000,
        wompi_transaction_id: TEST_TX_ID,
        estado: 'APPROVED',
      })
    )
  })

  it('ignora evento que no es transaction.updated', async () => {
    const { POST } = await import('@/app/api/pagos/webhook/route')
    const payload = { ...buildApprovedPayload(10000), event: 'payment.created' }
    const req = new Request('http://localhost/api/pagos/webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.event).toBe('payment.created')
  })

  it('idempotencia: si la transacción ya está en pagos_log como APPROVED, devuelve already_processed sin acreditar de nuevo', async () => {
    const defaultFrom = mockFrom.getMockImplementation()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'pagos_log') {
        return createChain({ maybeSingleData: { id: 'log-1', estado: 'APPROVED' } })
      }
      if (table === 'planes') {
        return createChain({ maybeSingleData: { precio_por_asamblea_cop: 10000 } })
      }
      if (table === 'profiles') {
        const chain = createChain({
          maybeSingleData: { tokens_disponibles: 51 },
          selectEqData: [{ tokens_disponibles: 50, organization_id: 'org-123' }],
          updateError: null,
        })
        chain.then = (resolve: (v: unknown) => void) => {
          resolve({ data: [{ tokens_disponibles: 50, organization_id: 'org-123' }], error: null })
        }
        return chain
      }
      return createChain({})
    })

    const { POST } = await import('@/app/api/pagos/webhook/route')
    const payload = buildApprovedPayload(10000)
    const req = new Request('http://localhost/api/pagos/webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.skipped).toBe('already_processed')
    expect(json.user_id).toBe(TEST_USER_ID)
    expect(json.tokens_disponibles).toBe(51)
    expect(mockRegistrarTransaccionPago).not.toHaveBeenCalled()

    if (defaultFrom) mockFrom.mockImplementation(defaultFrom as (table: string) => unknown)
  })
})
