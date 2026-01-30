/**
 * k6 - Prueba de carga para Asambleas App
 * https://k6.io/docs/
 *
 * Instalar k6: https://k6.io/docs/get-started/installation/
 * Ejecutar: k6 run k6/load-test.js
 * Con URL custom: k6 run k6/load-test.js -e BASE_URL=https://tu-app.vercel.app
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

// URL base: por defecto local; override con -e BASE_URL=...
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Escenario: subir usuarios virtuales hasta 100, mantener 1 min, bajar
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // subir a 20 usuarios en 30 s
    { duration: '1m', target: 50 },    // subir a 50 en 1 min
    { duration: '1m', target: 100 },   // subir a 100 en 1 min
    { duration: '2m', target: 100 },   // mantener 100 usuarios durante 2 min
    { duration: '30s', target: 0 },    // bajar a 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // 95% de peticiones < 5 s
    http_req_failed: ['rate<0.05'],      // menos del 5% de error
  },
}

export default function () {
  // 1. Página de login (pública)
  let res = http.get(`${BASE_URL}/login`)
  check(res, { 'login OK': (r) => r.status === 200 })
  sleep(1)

  // 2. Página principal (pública)
  res = http.get(`${BASE_URL}/`)
  check(res, { 'home OK': (r) => r.status === 200 })
  sleep(0.5)

  // 3. API client-info (usada al votar)
  res = http.get(`${BASE_URL}/api/client-info`)
  check(res, { 'client-info OK': (r) => r.status === 200 })
  sleep(0.5)

  sleep(1)
}
