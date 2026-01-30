/**
 * k6 - Stress test de votación
 * Simula 500 VUs que hacen: GET /api/client-info + POST /api/votar
 *
 * Requiere IDs válidos de una pregunta ABIERTA en tu BD:
 *   PREGUNTA_ID, OPCION_ID, UNIDAD_ID
 *
 * Ejecutar contra Vercel:
 *   k6 run k6/stress-test-votos.js \
 *     -e BASE_URL=https://asambleas-app-epbco.vercel.app \
 *     -e PREGUNTA_ID=uuid-pregunta \
 *     -e OPCION_ID=uuid-opcion \
 *     -e UNIDAD_ID=uuid-unidad
 *
 * La prueba FALLA si más del 2% de las peticiones fallan (threshold http_req_failed < 0.02).
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const PREGUNTA_ID = __ENV.PREGUNTA_ID
const OPCION_ID = __ENV.OPCION_ID
const UNIDAD_ID = __ENV.UNIDAD_ID

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],   // falla si más del 2% de peticiones fallan
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
