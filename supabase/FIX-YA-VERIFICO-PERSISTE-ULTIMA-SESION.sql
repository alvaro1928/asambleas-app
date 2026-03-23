-- ============================================================
-- FIX-YA-VERIFICO-PERSISTE-ULTIMA-SESION.sql
--
-- Problema: ya_verifico_asistencia y unidad_ids_verificados_sesion_actual
-- solo consideraban registros con creado_en >= apertura de una sesión ABIERTA.
-- Si la verificación está cerrada (sin fila con cierre_at IS NULL), la subconsulta
-- devuelve NULL y nadie aparece como verificado tras recargar la página.
--
-- Comportamiento deseado:
-- - Con sesión abierta: solo cuentan verificaciones desde esa apertura (ronda actual).
-- - Sin sesión abierta: persisten las verificaciones de la última sesión cerrada
--   [apertura_at, cierre_at] hasta que el admin abra una nueva ronda.
--
-- EJECUTAR en Supabase → SQL Editor → Run
-- ============================================================

CREATE OR REPLACE FUNCTION ya_verifico_asistencia(
  p_asamblea_id UUID,
  p_email       TEXT,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_apertura_abierta    TIMESTAMPTZ;
  v_apertura_ult_cerrada TIMESTAMPTZ;
  v_cierre_ult           TIMESTAMPTZ;
BEGIN
  SELECT s.apertura_at
    INTO v_apertura_abierta
    FROM verificacion_asamblea_sesiones s
   WHERE s.asamblea_id = p_asamblea_id
     AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
     AND s.cierre_at IS NULL
   ORDER BY s.apertura_at DESC
   LIMIT 1;

  IF v_apertura_abierta IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
        FROM verificacion_asistencia_registro r
        JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
        JOIN unidades u ON u.id = qa.unidad_id
       WHERE r.asamblea_id = p_asamblea_id
         AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
         AND r.creado_en >= v_apertura_abierta
         AND (
           LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
           OR unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), p_email)
         )
    );
  END IF;

  SELECT s.apertura_at, s.cierre_at
    INTO v_apertura_ult_cerrada, v_cierre_ult
    FROM verificacion_asamblea_sesiones s
   WHERE s.asamblea_id = p_asamblea_id
     AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
     AND s.cierre_at IS NOT NULL
   ORDER BY s.cierre_at DESC
   LIMIT 1;

  IF v_apertura_ult_cerrada IS NULL OR v_cierre_ult IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM verificacion_asistencia_registro r
      JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
      JOIN unidades u ON u.id = qa.unidad_id
     WHERE r.asamblea_id = p_asamblea_id
       AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
       AND r.creado_en >= v_apertura_ult_cerrada
       AND r.creado_en <= v_cierre_ult
       AND (
         LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
         OR unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), p_email)
       )
  );
END;
$$;

COMMENT ON FUNCTION ya_verifico_asistencia(UUID, TEXT, UUID) IS
  'True si el votante verificó en la sesión abierta actual, o en la última sesión cerrada si no hay ninguna abierta (persistente hasta nueva ronda).';

DROP FUNCTION IF EXISTS unidad_ids_verificados_sesion_actual(UUID, UUID);

CREATE OR REPLACE FUNCTION unidad_ids_verificados_sesion_actual(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS TABLE (unidad_id UUID, es_poder BOOLEAN)
LANGUAGE sql
STABLE
AS $$
  WITH ultima_cerrada AS (
    SELECT s.apertura_at AS apertura_ult_cerrada, s.cierre_at AS cierre_ult
      FROM verificacion_asamblea_sesiones s
     WHERE s.asamblea_id = p_asamblea_id
       AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
       AND s.cierre_at IS NOT NULL
     ORDER BY s.cierre_at DESC
     LIMIT 1
  ),
  ventana AS (
    SELECT
      (SELECT s.apertura_at
         FROM verificacion_asamblea_sesiones s
        WHERE s.asamblea_id = p_asamblea_id
          AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
          AND s.cierre_at IS NULL
        ORDER BY s.apertura_at DESC
        LIMIT 1) AS apertura_abierta,
      (SELECT u.apertura_ult_cerrada FROM ultima_cerrada u) AS apertura_ult_cerrada,
      (SELECT u.cierre_ult FROM ultima_cerrada u) AS cierre_ult
  )
  SELECT DISTINCT ON (qa.unidad_id)
    qa.unidad_id,
    CASE
      WHEN unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), qa.email_propietario) THEN false
      WHEN EXISTS (
        SELECT 1 FROM poderes p
        WHERE p.unidad_otorgante_id = qa.unidad_id
          AND p.asamblea_id = p_asamblea_id
          AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(qa.email_propietario))
          AND p.estado = 'activo'
      ) THEN true
      ELSE false
    END AS es_poder
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  CROSS JOIN ventana w
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND (
      (w.apertura_abierta IS NOT NULL AND r.creado_en >= w.apertura_abierta)
      OR (
        w.apertura_abierta IS NULL
        AND w.apertura_ult_cerrada IS NOT NULL
        AND w.cierre_ult IS NOT NULL
        AND r.creado_en >= w.apertura_ult_cerrada
        AND r.creado_en <= w.cierre_ult
      )
    )
  ORDER BY qa.unidad_id;
$$;

COMMENT ON FUNCTION unidad_ids_verificados_sesion_actual(UUID, UUID) IS
  'Unidades con asistencia verificada en la sesión abierta, o en la última sesión cerrada si no hay abierta (delegado / listas).';
