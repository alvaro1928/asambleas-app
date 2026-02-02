/**
 * k6 - Stress test de votación
 * Simula VUs que hacen: GET /api/client-info + POST /api/votar
 *
 * Variables de entorno:
 *   BASE_URL     - URL base (default: http://localhost:3000)
 *   PREGUNTA_ID  - UUID de pregunta ABIERTA
 *   OPCION_ID    - UUID de opción
 *   UNIDAD_ID    - UUID de unidad
 *   DURATION_MS  - Ventana total en ms (default: 10000 = 10s). Usado para construir stages.
 *   TARGET_VOTES - VUs objetivo (default: 500). Coincide con scripts/stress-test.js.
 *
 * Ejemplo producción:
 *   k6 run k6/stress-test-votos.js \
 *     -e BASE_URL=https://asambleas-app-epbco-b92ryy32p.vercel.app \
 *     -e PREGUNTA_ID=uuid -e OPCION_ID=uuid -e UNIDAD_ID=uuid \
 *     -e DURATION_MS=10000 -e TARGET_VOTES=500
 *
 * La prueba FALLA si más del 2% de las peticiones fallan (threshold http_req_failed < 0.02).
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const PREGUNTA_ID = __ENV.PREGUNTA_ID
const OPCION_ID = __ENV.OPCION_ID
const UNIDAD_ID = __ENV.UNIDAD_ID
const DURATION_MS = parseInt(__ENV.DURATION_MS || '10000', 10)
const TARGET_VOTES = parseInt(__ENV.TARGET_VOTES || '500', 10)

const durationSec = Math.max(1, Math.floor(DURATION_MS / 1000))
const rampUp = Math.max(5, Math.floor(durationSec * 0.2))
const hold = Math.max(5, Math.floor(durationSec * 0.6))
const rampDown = Math.max(5, Math.floor(durationSec * 0.2))

export const options = {
  stages: [
    { duration: `${rampUp}s`, target: Math.min(100, TARGET_VOTES) },
    { duration: `${rampUp}s`, target: TARGET_VOTES },
    { duration: `${hold}s`, target: TARGET_VOTES },
    { duration: `${rampDown}s`, target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<5000'],
  },
}

export default function () {
  if (!PREGUNTA_ID || !OPCION_ID || !UNIDAD_ID) {
    console.warn('Faltan PREGUNTA_ID, OPCION_ID o UNIDAD_ID; usa -e PREGUNTA_ID=... -e OPCION_ID=... -e UNIDAD_ID=...')
  }

  // 1. GET /api/client-info (trazabilidad)
  let res = http.get(`${BASE_URL}/api/client-info`)
  check(res, { 'client-info OK': (r) => r.status === 200 })
  sleep(0.3)

  // 2. POST /api/votar (cuerpo simula voto real)
  const payload = JSON.stringify({
    pregunta_id: PREGUNTA_ID,
    opcion_id: OPCION_ID,
    unidad_id: UNIDAD_ID,
    votante_email: `stress-votante-${__VU}-${__ITER}@test.local`,
    votante_nombre: `Votante ${__VU}-${__ITER}`,
  })

  res = http.post(`${BASE_URL}/api/votar`, payload, {
    headers: { 'Content-Type': 'application/json' },
  })

  check(res, {
    'votar OK': (r) => r.status === 200,
    'votar body success': (r) => {
      try {
        const b = JSON.parse(r.body)
        return b && (b.success === true || b.data != null)
      } catch {
        return false
      }
    },
  })

  sleep(0.5)
}
