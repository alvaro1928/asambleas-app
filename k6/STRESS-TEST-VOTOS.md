# Stress test de votación (k6)

El script `stress-test-votos.js` simula **500 usuarios virtuales (VUs)** que:

1. Hacen **GET** a `/api/client-info` (trazabilidad).
2. Hacen **POST** a `/api/votar` con un cuerpo que simula un voto real.

**Threshold:** La prueba **falla** si más del **2%** de las peticiones fallan (`http_req_failed < 0.02`).

---

## Requisitos

- Tener **k6** instalado: [k6 – Installation](https://k6.io/docs/get-started/installation/).
- Tener en Supabase una **pregunta en estado "abierta"** y al menos una opción y una unidad válidas, para usar sus IDs en las variables de entorno.

---

## Cómo obtener los IDs (pregunta, opción, unidad)

En Supabase (SQL Editor) o desde tu app:

1. **PREGUNTA_ID**: ID de una pregunta con `estado = 'abierta'`.
   ```sql
   SELECT id, texto_pregunta, estado FROM preguntas WHERE estado = 'abierta' LIMIT 1;
   ```
2. **OPCION_ID**: ID de una opción de esa pregunta.
   ```sql
   SELECT id, texto_opcion FROM opciones_pregunta WHERE pregunta_id = '<PREGUNTA_ID>' LIMIT 1;
   ```
3. **UNIDAD_ID**: ID de una unidad del mismo conjunto (organization) de la asamblea.
   ```sql
   SELECT u.id FROM unidades u
   JOIN asambleas a ON a.organization_id = (SELECT organization_id FROM asambleas WHERE id = '<ASAMBLEA_ID>')
   LIMIT 1;
   ```
   O desde el dashboard de la app: listado de unidades o de votantes de esa asamblea.

Sustituye `<PREGUNTA_ID>` y `<ASAMBLEA_ID>` por los UUID reales.

---

## Ejecutar contra Vercel (BASE_URL de producción)

Pasa la URL base de tu app en Vercel y los tres IDs:

```bash
k6 run k6/stress-test-votos.js \
  -e BASE_URL=https://asambleas-app-epbco.vercel.app \
  -e PREGUNTA_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  -e OPCION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  -e UNIDAD_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Windows (PowerShell)** – una línea:

```powershell
k6 run k6/stress-test-votos.js -e BASE_URL=https://asambleas-app-epbco.vercel.app -e PREGUNTA_ID=uuid-pregunta -e OPCION_ID=uuid-opcion -e UNIDAD_ID=uuid-unidad
```

Sustituye `uuid-pregunta`, `uuid-opcion` y `uuid-unidad` por los UUID reales obtenidos antes.

---

## Ejecutar contra local

Con la app en marcha (`npm run dev`):

```bash
k6 run k6/stress-test-votos.js \
  -e BASE_URL=http://localhost:3000 \
  -e PREGUNTA_ID=... \
  -e OPCION_ID=... \
  -e UNIDAD_ID=...
```

---

## Cuerpo del POST (voto simulado)

El script envía en cada POST a `/api/votar` un JSON como:

- `pregunta_id`: valor de `PREGUNTA_ID`
- `opcion_id`: valor de `OPCION_ID`
- `unidad_id`: valor de `UNIDAD_ID`
- `votante_email`: `stress-votante-{VU}-{ITER}@test.local` (ficticio, único por iteración)
- `votante_nombre`: `Votante {VU}-{ITER}`

Si usas el mismo `UNIDAD_ID` para todas las VUs, en BD se actualizará siempre el mismo voto (una unidad, una opción por pregunta); el estrés es sobre el endpoint y la base de datos.

---

## Interpretar el resultado

- **http_req_failed:** Porcentaje de peticiones fallidas. Si supera el 2%, la prueba falla (threshold `rate<0.02`).
- **http_req_duration:** Latencia (p. ej. p95 < 5000 ms).
- **iterations:** Número de veces que se ejecutó el flujo (GET client-info + POST votar).

Si la prueba falla, revisa logs en Vercel y Supabase (errores 4xx/5xx, límites de conexiones, RLS, etc.).
