-- =====================================================
-- FASE 2: Perfilado de funciones calientes (read-only)
-- =====================================================
-- Objetivo:
-- - Obtener planes reales de ejecución para funciones con mayor costo
--   observadas en pg_stat_statements.
-- - Identificar scans secuenciales, filtros costosos, joins y buffers.
--
-- IMPORTANTE:
-- - Ejecutar en un entorno con datos representativos.
-- - Reemplazar UUID/valores de ejemplo antes de correr.
-- - Este script NO modifica datos (solo EXPLAIN ANALYZE de SELECTs).
-- =====================================================

BEGIN;

-- A) Parámetros de observabilidad para la sesión actual
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

-- B) Caso 1: calcular_quorum_asamblea(p_asamblea_id)
-- Alta frecuencia y alto tiempo acumulado.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT *
FROM public.calcular_quorum_asamblea(
  p_asamblea_id := '00000000-0000-0000-0000-000000000000'::uuid
);

-- C) Caso 2: calcular_estadisticas_pregunta(p_pregunta_id)
-- Ejecutada por anon/authenticated con costo relevante.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT *
FROM public.calcular_estadisticas_pregunta(
  p_pregunta_id := '00000000-0000-0000-0000-000000000000'::uuid
);

-- D) Caso 3: ya_verifico_asistencia(p_asamblea_id, p_email, p_pregunta_id)
-- Punto caliente de verificación online.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT public.ya_verifico_asistencia(
  p_asamblea_id := '00000000-0000-0000-0000-000000000000'::uuid,
  p_email := 'correo@ejemplo.com',
  p_pregunta_id := '00000000-0000-0000-0000-000000000000'::uuid
);

-- E) Caso 4: calcular_verificacion_quorum_desglose(...)
-- Tiene picos altos de latencia en métricas.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT *
FROM public.calcular_verificacion_quorum_desglose(
  p_asamblea_id := '00000000-0000-0000-0000-000000000000'::uuid,
  p_pregunta_id := '00000000-0000-0000-0000-000000000000'::uuid,
  p_solo_sesion_actual := true
);

-- F) Caso 5 opcional: validar_codigo_acceso(p_codigo)
-- Muy frecuente; normalmente barato, pero útil para validar outliers.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT *
FROM public.validar_codigo_acceso(
  p_codigo := 'ABC123'
);

COMMIT;

-- =====================================================
-- Checklist de lectura de resultados:
-- 1) ¿Hay Seq Scan en tablas grandes? -> revisar índice/filtro.
-- 2) ¿Rows Removed by Filter alto? -> predicado poco selectivo.
-- 3) ¿Buffers read alto vs hit alto? -> presión de I/O.
-- 4) ¿Nested Loop costoso con muchas filas? -> revisar join/index.
-- 5) ¿Tiempo mayor dentro de Function Scan? -> optimizar SQL interno.
-- =====================================================
