#!/usr/bin/env node
/**
 * Stress test: 500 votos en ~10 segundos contra POST /api/votar
 *
 * Uso:
 *   npm run test:stress
 *   BASE_URL=http://localhost:3000 PREGUNTA_ID=... OPCION_ID=... UNIDAD_IDS='["id1","id2",...]' node scripts/stress-test.js
 *
 * Variables de entorno:
 *   BASE_URL          - URL base (default: http://localhost:3000)
 *   PREGUNTA_ID       - UUID de pregunta abierta
 *   OPCION_ID         - UUID de opción (ej. "A favor")
 *   UNIDAD_IDS        - JSON array de UUIDs de unidades (mín. 500 para 500 votos distintos; si hay menos se repiten)
 *   STRESS_TEST_SECRET - (opcional) Header X-Stress-Test-Secret para entorno de pruebas
 *   DURATION_MS       - Ventana de tiempo en ms (default: 10000 = 10s)
 *   TARGET_VOTES      - Número de votos a simular (default: 500)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const PREGUNTA_ID = process.env.PREGUNTA_ID
const OPCION_ID = process.env.OPCION_ID
const UNIDAD_IDS_JSON = process.env.UNIDAD_IDS
const STRESS_TEST_SECRET = process.env.STRESS_TEST_SECRET
const DURATION_MS = parseInt(process.env.DURATION_MS || '10000', 10)
const TARGET_VOTES = parseInt(process.env.TARGET_VOTES || '500', 10)

function parseUnidadIds() {
  if (!UNIDAD_IDS_JSON) return null
  try {
    const arr = JSON.parse(UNIDAD_IDS_JSON)
    return Array.isArray(arr) ? arr.map(String) : null
  } catch {
    return null
  }
}

function getUnidadIds() {
  const parsed = parseUnidadIds()
  if (parsed && parsed.length >= 1) {
    const repeated = []
    for (let i = 0; i < TARGET_VOTES; i++) repeated.push(parsed[i % parsed.length])
    return repeated
  }
  return null
}

async function sendVoto(unidadId, index) {
  const start = performance.now()
  const url = `${BASE_URL.replace(/\/$/, '')}/api/votar`
  const body = {
    pregunta_id: PREGUNTA_ID,
    opcion_id: OPCION_ID,
    unidad_id: unidadId,
    votante_email: `stress-votante-${index}@test.local`,
    votante_nombre: `Votante stress ${index}`,
  }
  const headers = { 'Content-Type': 'application/json' }
  if (STRESS_TEST_SECRET) headers['X-Stress-Test-Secret'] = STRESS_TEST_SECRET

  let ok = false
  let status = 0
  let errMsg = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    status = res.status
    const data = await res.json().catch(() => ({}))
    ok = res.ok && (data.success === true || data.data != null)
    if (!res.ok) errMsg = data.error || res.statusText
  } catch (e) {
    errMsg = e.message || String(e)
  }
  const latencyMs = Math.round(performance.now() - start)
  return { ok, status, latencyMs, errMsg }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function run() {
  console.log('=== Stress test: votación ===')
  console.log('BASE_URL:', BASE_URL)
  console.log('TARGET_VOTES:', TARGET_VOTES)
  console.log('DURATION_MS:', DURATION_MS)

  if (!PREGUNTA_ID || !OPCION_ID) {
    console.error('Faltan PREGUNTA_ID u OPCION_ID. Exporta también UNIDAD_IDS (JSON array de UUIDs).')
    process.exit(1)
  }

  const unidadIds = getUnidadIds()
  if (!unidadIds) {
    console.error('Faltan UNIDAD_IDS (ej: UNIDAD_IDS=\'["uuid1","uuid2",...]\'). Necesitas al menos 1 unidad (se reutiliza para 500 votos).')
    process.exit(1)
  }

  const intervalMs = DURATION_MS / TARGET_VOTES
  const results = []
  const latencies = []

  console.log(`\nEnviando ${TARGET_VOTES} votos en ~${(DURATION_MS / 1000).toFixed(1)}s (~${(1000 / intervalMs).toFixed(0)}/s)...\n`)

  const startTotal = performance.now()
  const promises = []
  for (let i = 0; i < TARGET_VOTES; i++) {
    const unidadId = unidadIds[i]
    const p = new Promise((resolve) => {
      const t = setTimeout(async () => {
        const r = await sendVoto(unidadId, i)
        results.push(r)
        if (r.latencyMs != null) latencies.push(r.latencyMs)
        resolve()
      }, i * intervalMs)
    })
    promises.push(p)
  }
  await Promise.all(promises)
  const totalMs = Math.round(performance.now() - startTotal)

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount
  const latenciesOk = results.filter((r) => r.ok).map((r) => r.latencyMs).filter((n) => n != null)

  console.log('--- Resultados ---')
  console.log('Total enviados:', results.length)
  console.log('Éxitos:', okCount)
  console.log('Fallos:', failCount)
  console.log('Tiempo total (ms):', totalMs)
  if (latenciesOk.length > 0) {
    console.log('Latencia p50 (ms):', percentile(latenciesOk, 50))
    console.log('Latencia p95 (ms):', percentile(latenciesOk, 95))
    console.log('Latencia p99 (ms):', percentile(latenciesOk, 99))
    const under200 = latenciesOk.filter((n) => n < 200).length
    console.log('Votos con latencia < 200ms:', under200, `(${((under200 / latenciesOk.length) * 100).toFixed(1)}%)`)
  }
  if (failCount > 0) {
    const errors = {}
    results.filter((r) => !r.ok).forEach((r) => {
      const key = r.errMsg || `status ${r.status}`
      errors[key] = (errors[key] || 0) + 1
    })
    console.log('Errores:', errors)
  }
  console.log('\nObjetivo: latencia < 200ms por voto (landing).')
  process.exit(failCount > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
