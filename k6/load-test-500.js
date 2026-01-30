/**
 * k6 - Prueba de carga más agresiva (hasta ~500 usuarios virtuales)
 * Ejecutar: k6 run k6/load-test-500.js -e BASE_URL=https://tu-app.vercel.app
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 500 },
    { duration: '3m', target: 500 },   // mantener 500 durante 3 min
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<8000'],  // 95% < 8 s bajo mucha carga
    http_req_failed: ['rate<0.10'],      // menos del 10% de error
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/login`)
  check(res, { 'login OK': (r) => r.status === 200 })
  sleep(1)
}
