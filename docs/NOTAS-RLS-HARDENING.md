# Notas: RLS / hardening y páginas públicas

Tras endurecer políticas RLS en Supabase, las lecturas con el **cliente JS** (`supabase.from` / RPC como el rol del invocador) pueden devolver **0 filas** si en el mismo navegador hay una sesión **`authenticated`** de **otra** organización (típico: gestor que abre `/votar/...` o `/asistir/...` sin cerrar sesión).

## Qué ya está cubierto (service role en API)

| Flujo | Evita RLS en cliente |
|--------|----------------------|
| `/votar` — validar código | `POST /api/votar/validar-codigo-acceso` (+ fallback RPC solo si falla la red) |
| `/votar` — lista de preguntas abiertas | `POST /api/votar/preguntas-abiertas` (sin fallback `supabase.from` en cliente) |
| `/votar` — verificación / flags | `POST /api/votar/estado-verificacion` |
| Votante — identificador | `POST /api/votar/validar-identificador` |
| `/asistir` (delegado) — validación | `POST /api/delegado/validar` |
| `/asistir` — unidades + verificación sesión | `POST /api/delegado/unidades-y-verificacion` |
| `/asistir` — preguntas, votos, estadísticas | `POST /api/delegado/estado-votacion` |
| Acciones delegado (voto, asistencia, timer) | Rutas `/api/delegado/*` con token |

## Qué sigue usando el cliente en `/votar` (revisar si hay incidencias)

- RPC: `calcular_estadisticas_pregunta`, `registrar_voto_con_trazabilidad`, `calcular_verificacion_quorum`, `ya_verifico_asistencia`, etc.
- Tablas: historial (preguntas cerradas), votos, realtime en `preguntas`.
- Si en BD las funciones están como **SECURITY DEFINER** o con `row_security = off` donde corresponde, el comportamiento es correcto también con sesión cruzada.
- El fallback de `refrescarVerificacion` que usa `supabase.from('asambleas')` solo corre si la API devuelve error; en ese caso puede fallar por RLS.

## Dashboard

Las pantallas bajo `/dashboard/*` con usuario autenticado de la **misma** organización no deben verse afectadas por el problema “otra org”.

## Modal de asistencia manual (`ModalRegistroAsistencia`)

Usa `supabase` en el cliente; solo se abre desde el panel con un usuario que ya tiene acceso a esa asamblea. Si en el futuro apareciera el mismo síntoma, mover la carga a una ruta API con `service_role` y comprobación de membresía.
