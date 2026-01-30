# Análisis del reporte de slow queries

Resumen del reporte de consultas lentas de la base de datos y acciones recomendadas.

---

## 1. Resumen ejecutivo

| Origen              | % tiempo aprox. | Acción                    |
|---------------------|------------------|---------------------------|
| Internas Supabase   | ~63 %            | No accionable (plataforma)|
| De la aplicación    | ~20 %            | **Sí: índices y caché**   |
| Auth / sesión       | ~5 %             | Normal (muchas llamadas)   |
| Otros (dashboard, backup) | ~12 %     | Puntual / una sola vez    |

La mayor parte del tiempo viene de consultas **internas de Supabase/PostgREST** (catálogo, timezone, introspección). Solo una parte menor corresponde a **tu aplicación**; ahí sí puedes optimizar con índices y caché.

---

## 2. Consultas internas (no accionables)

No puedes optimizarlas directamente; son de la plataforma.

| Consulta / rol        | % tiempo | Qué es |
|-----------------------|----------|--------|
| `SELECT name FROM pg_timezone_names` (authenticator) | **32,0** | PostgREST al establecer sesión / timezone. |
| CTE introspección de funciones (postgres)           | **31,5** | Dashboard Supabase (listado de funciones). |
| `pg_available_extensions` (postgres)                | **6,1**  | Dashboard / extensiones. |
| `set_config('search_path', ...)` (authenticated)    | **3,2**  | PostgREST por cada request (JWT, path, etc.). |
| CTE “base_types” / argumentos (authenticator)      | **2,4**  | Introspección de tipos/funciones. |
| Tablas/columnas (postgres)                          | **1,4**  | Dashboard (schema browser). |
| Schemas (postgres)                                  | **0,4**  | Dashboard. |
| `count_estimate` (postgres)                         | **0,4**  | Dashboard (estimación de filas). |

**Conclusión:** ~63 % del tiempo total viene de estas consultas. No hay cambios recomendados en tu código ni en tu esquema por ellas.

---

## 3. Consultas de tu aplicación (accionables)

Son las que sí puedes mejorar con índices y/o caché.

### 3.1 `calcular_quorum_asamblea` (RPC)

- **Llamadas:** 20 205  
- **Tiempo medio:** 0,44 ms | **Máximo:** 314 ms  
- **% tiempo total:** **6,2**  
- **Cache hit:** 100 %

**Qué hace:** Lee `asambleas`, `unidades` (por `organization_id`) y `votos` + `preguntas` (por `asamblea_id`).

**Recomendaciones:**

1. **Índices:** Asegurar índices en:
   - `votos(pregunta_id)` y/o `votos(pregunta_id, unidad_id)`
   - `preguntas(asamblea_id)`
   - `unidades(organization_id)`
2. **Caché en frontend:** No llamar al RPC cada pocos segundos; usar intervalo mayor (p. ej. 15–30 s) o solo al cambiar de pestaña/volver a la pantalla.

---

### 3.2 `calcular_estadisticas_pregunta` (RPC)

- **Llamadas:** 12 950 + 7 512 (dos variantes en el reporte)  
- **Tiempo medio:** ~0,5–0,7 ms | **Máximo:** ~95–300 ms  
- **% tiempo total:** **~5,2 + 3,9**  
- **Cache hit:** 99,99 % / 100 %

**Qué hace:** Lee `preguntas`, `votos` (por `pregunta_id`), `unidades`, `opciones_pregunta` (por `pregunta_id`).

**Recomendaciones:**

1. **Índices:**
   - `votos(pregunta_id)`, `votos(pregunta_id, opcion_id)`
   - `opciones_pregunta(pregunta_id)`
2. **Caché:** Igual que quórum: reducir frecuencia de refresco cuando muchas preguntas están visibles (p. ej. página de votar o dashboard).

---

### 3.3 `opciones_pregunta` (PostgREST)

- **Consulta:** `WHERE pregunta_id = $1 ORDER BY orden`  
- **Llamadas:** 29 719  
- **% tiempo:** **1,3**  
- **Cache hit:** 100 %

**Recomendación:** Índice en `opciones_pregunta(pregunta_id)` (y si sueles ordenar por `orden`, un índice compuesto `(pregunta_id, orden)` puede ayudar). El script `supabase/OPTIMIZAR-INDICES-SLOW-QUERIES.sql` incluye estas opciones.

---

### 3.4 `preguntas` (PostgREST)

- **Consulta:** `WHERE asamblea_id = $1 ORDER BY orden`  
- **Llamadas:** 27 890  
- **% tiempo:** **1,1**  
- **Cache hit:** 100 %

**Recomendación:** Índice en `preguntas(asamblea_id)` y, si aplica, compuesto `(asamblea_id, orden)` para el ORDER BY.

---

### 3.5 `asambleas` (PostgREST)

- **Consulta:** `WHERE id = $1 AND organization_id = $2`  
- **Llamadas:** 18 955  
- **% tiempo:** **0,7**  
- **Cache hit:** 100 %

**Recomendación:** La búsqueda por `id` ya usa la PK. No es prioritario añadir más índices aquí; con PK es suficiente.

---

## 4. Auth y sesión (comportamiento esperado)

| Consulta        | Rol                  | Llamadas | % tiempo |
|-----------------|----------------------|----------|----------|
| `users` (id)    | supabase_auth_admin  | 35 466   | 1,0      |
| `identities`    | supabase_auth_admin  | 35 632   | 0,6      |
| `sessions`     | supabase_auth_admin  | 35 492   | 0,6      |

Son muchas llamadas con tiempo bajo; típico de auth. No requieren acción salvo que tengas picos de error o latencia en login.

---

## 5. Otras (puntuales)

- **`pg_backup_start`** (supabase_admin): 6 llamadas, ~0,6 % — backups; normal.
- **`CREATE UNIQUE INDEX CONCURRENTLY`** (storage): 1 llamada, ~0,5 % — migración única; no se repite.
- **`count_estimate`** (postgres): ya contado en “internas”.

---

## 6. Checklist de acciones

1. **Ejecutar en Supabase (SQL Editor)** el script de índices:
   - `supabase/OPTIMIZAR-INDICES-SLOW-QUERIES.sql`
2. **Revisar en el código** la frecuencia de llamadas a:
   - `calcular_quorum_asamblea`
   - `calcular_estadisticas_pregunta`  
   Reducir polling (intervalo más largo o solo al enfocar la ventana).
3. **Volver a medir** tras unos días y comparar el nuevo reporte de slow queries con este.

---

## 7. Referencia rápida de índices recomendados

| Tabla             | Índice recomendado           | Uso principal                          |
|-------------------|------------------------------|----------------------------------------|
| `votos`           | `(pregunta_id)`              | RPC estadísticas y quórum              |
| `votos`           | `(pregunta_id, unidad_id)`   | Quórum (unidades distintas)            |
| `votos`           | `(pregunta_id, opcion_id)`   | Estadísticas por opción                |
| `preguntas`       | `(asamblea_id)`              | Listado preguntas por asamblea / quórum|
| `opciones_pregunta` | `(pregunta_id)`            | Listado opciones por pregunta          |
| `opciones_pregunta` | `(pregunta_id, orden)`     | Mismo listado con ORDER BY orden       |
| `unidades`        | `(organization_id)`         | Quórum (unidades del conjunto)         |

Si alguno de estos índices ya existe en tu proyecto (p. ej. en migraciones o en `CREAR-MODULO-ASAMBLEAS.sql`, `AGREGAR-TRAZABILIDAD-VOTOS.sql`), el script usa `IF NOT EXISTS` para no duplicarlos.
