# Stress test: 500+ votantes simultáneos

Objetivo: validar que el sistema mantenga **latencia < 200 ms** por voto con 500 votos en 10 segundos (como se promociona en la landing).

---

## Checklist de preparación

| Elemento | Estado |
|----------|--------|
| **Scripts** | `scripts/stress-test.js` y `k6/stress-test-votos.js` usan `DURATION_MS` y `TARGET_VOTES`. |
| **Función SQL** | `registrar_voto_con_trazabilidad` en Supabase implementa `SELECT ... FOR UPDATE` (ver `supabase/OPTIMIZAR-REGISTRO-VOTO-CONCURRENCY.sql`). |
| **Monitoreo** | El route handler de `/api/votar` inyecta el header `X-Response-Time-Ms` y registra logs cuando latencia > 200 ms. |
| **Reset** | `POST /api/stress-test/reset` protegido por `NODE_ENV=development` o `STRESS_TEST_SECRET`. |
| **NPM** | `package.json` incluye `"test:stress": "node scripts/stress-test.js"`. |

---

## 1. Script de simulación (Node)

El script `scripts/stress-test.js` realiza **500 POST** a `/api/votar` repartidos en **10 segundos**.

### Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `BASE_URL` | URL base de la app | `http://localhost:3000` |
| `PREGUNTA_ID` | UUID de una pregunta con votación **abierta** | |
| `OPCION_ID` | UUID de una opción (ej. "A favor") | |
| `UNIDAD_IDS` | JSON array de UUIDs de unidades (se reutilizan si hay menos de 500) | `["uuid1","uuid2",...]` |
| `STRESS_TEST_SECRET` | (Opcional) Header para entorno de pruebas | |
| `DURATION_MS` | Ventana de tiempo en ms (default: 10000) | 10000 |
| `TARGET_VOTES` | Número de votos a simular (default: 500) | 500 |

### Ejecución

```bash
# Con servidor local levantado (npm run dev)
npm run test:stress

# Contra producción (sustituye PREGUNTA_ID, OPCION_ID y UNIDAD_IDS por UUIDs reales)
BASE_URL=https://asambleas-app-epbco-b92ryy32p.vercel.app \
PREGUNTA_ID=uuid-pregunta \
OPCION_ID=uuid-opcion \
UNIDAD_IDS='["uuid-unidad-1"]' \
npm run test:stress

# Con variables explícitas (local)
BASE_URL=http://localhost:3000 \
PREGUNTA_ID=uuid-pregunta \
OPCION_ID=uuid-opcion \
UNIDAD_IDS='["uuid-unidad-1"]' \
npm run test:stress
```

Si solo tienes una unidad, pásala en `UNIDAD_IDS` y se reutilizará para los 500 votos (primer voto = INSERT, el resto = UPDATE de la misma fila). Para 500 unidades distintas, genera un array con 500 UUIDs (por ejemplo exportando desde Supabase las unidades de tu conjunto de prueba).

### Salida

- Total enviados, éxitos, fallos
- Latencia p50, p95, p99 (ms)
- Votos con latencia < 200 ms (objetivo)
- Errores agrupados (si hay fallos)

---

## 2. Optimización de base de datos

El endpoint `/api/votar` llama a la función `registrar_voto_con_trazabilidad` en Supabase. Para evitar condiciones de carrera y bloqueos con muchos votos simultáneos:

1. **Migración aplicada:** `supabase/OPTIMIZAR-REGISTRO-VOTO-CONCURRENCY.sql`  
   - Usa `SELECT ... FOR UPDATE` sobre la fila `(pregunta_id, unidad_id)` antes de INSERT/UPDATE.  
   - Ejecútala en el **SQL Editor** de Supabase si aún no está aplicada.

2. **Descuento de tokens:** El flujo de **votación pública** (`POST /api/votar`) **no** descuenta tokens; los tokens se consumen al activar votación o al generar acta. Por tanto, la latencia por voto no depende de la Billetera Central.

---

## 3. Monitoreo de latencia

- El **route handler** de `POST /api/votar` (`app/api/votar/route.ts`) inyecta en **todas** sus respuestas (200, 400, 500) el header **`X-Response-Time-Ms`** (tiempo en ms desde el inicio de la petición).
- El servidor registra logs cuando:
  - `NODE_ENV !== 'production'` (cada respuesta), o
  - latencia > 200 ms en producción (para detectar picos).

Ejemplo de log: `[api/votar] latency_ms=145 pregunta_id=... unidad_id=...`

---

## 4. Limpieza post-prueba

**POST /api/stress-test/reset**

Limpia los votos de una asamblea de prueba para poder repetir el test.

- **Solo disponible:** en `NODE_ENV=development` o enviando `STRESS_TEST_SECRET` en `.env` y en el body.
- **Body:** `{ "asamblea_id": "uuid-asamblea", "secret": "opcional-si-env-está-configurado" }`

```bash
curl -X POST http://localhost:3000/api/stress-test/reset \
  -H "Content-Type: application/json" \
  -d '{"asamblea_id":"uuid-de-tu-asamblea-de-prueba"}'
```

Respuesta: `votos_eliminados`, `historial_eliminado`. Los **tokens del gestor no se devuelven** automáticamente (se consumen al activar votación o generar acta).

---

## 5. k6 (alternativa)

En la carpeta `k6/` está **`k6/stress-test-votos.js`**, que usa los mismos parámetros de tiempo y volumen:

| Variable | Descripción | Default |
|----------|-------------|---------|
| `BASE_URL` | URL base | `http://localhost:3000` |
| `PREGUNTA_ID` | UUID pregunta abierta | — |
| `OPCION_ID` | UUID opción | — |
| `UNIDAD_ID` | UUID unidad | — |
| `DURATION_MS` | Ventana total en ms | 10000 |
| `TARGET_VOTES` | VUs objetivo | 500 |

Los stages se generan a partir de `DURATION_MS` y `TARGET_VOTES` (rampa, mantenimiento, bajada).

```bash
k6 run k6/stress-test-votos.js \
  -e BASE_URL=https://asambleas-app-epbco-b92ryy32p.vercel.app \
  -e PREGUNTA_ID=... -e OPCION_ID=... -e UNIDAD_ID=... \
  -e DURATION_MS=10000 -e TARGET_VOTES=500
```
