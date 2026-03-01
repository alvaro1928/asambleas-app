-- ============================================================
-- Verificación por sesión actual: al reactivar es una nueva ronda
-- - Al desactivar: se cierra la traza (snapshot en sesiones) para el acta.
-- - Al activar: nueva sesión; "ya verificaron" / "faltan" y stats solo cuentan esta sesión.
-- Requiere: verificacion_asamblea_sesiones (ADD-VERIFICACION-ASISTENCIA-SESIONES o ADD-VERIFICACION-ASISTENCIA-POR-PREGUNTA)
-- ============================================================

-- 1. Unidad IDs que verificaron solo en la sesión actual (creado_en >= apertura_at de la sesión abierta)
CREATE OR REPLACE FUNCTION unidad_ids_verificados_sesion_actual(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS TABLE (unidad_id UUID)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT qa.unidad_id
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND r.creado_en >= (
      SELECT s.apertura_at
      FROM verificacion_asamblea_sesiones s
      WHERE s.asamblea_id = p_asamblea_id
        AND s.cierre_at IS NULL
      ORDER BY s.apertura_at DESC
      LIMIT 1
    );
$$;

COMMENT ON FUNCTION unidad_ids_verificados_sesion_actual(UUID, UUID) IS
  'Unidad IDs que verificaron asistencia en la sesión actual (desde la última apertura).';

-- 2. calcular_verificacion_quorum: opción de filtrar solo sesión actual (para panel en vivo)
CREATE OR REPLACE FUNCTION calcular_verificacion_quorum(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL,
  p_solo_sesion_actual BOOLEAN DEFAULT false
)
RETURNS TABLE (
  total_verificados      INT,
  coeficiente_verificado NUMERIC(12, 6),
  porcentaje_verificado  NUMERIC(6, 2),
  quorum_alcanzado       BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
  v_corte           TIMESTAMPTZ;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF p_solo_sesion_actual THEN
    SELECT s.apertura_at INTO v_corte
    FROM verificacion_asamblea_sesiones s
    WHERE s.asamblea_id = p_asamblea_id
      AND s.cierre_at IS NULL
    ORDER BY s.apertura_at DESC
    LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_is_demo;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT r.quorum_asamblea_id)::INT                              AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)                       AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                                   AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                                   AS quorum_alcanzado
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND (NOT p_solo_sesion_actual OR (v_corte IS NOT NULL AND r.creado_en >= v_corte));
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum(UUID, UUID, BOOLEAN) IS
  'Calcula verificación. Si p_solo_sesion_actual=true solo cuenta la sesión actual (desde última apertura).';

-- 3. ya_verifico_asistencia: solo en la sesión actual (reactivar = todos pendientes de nuevo)
CREATE OR REPLACE FUNCTION ya_verifico_asistencia(
  p_asamblea_id UUID,
  p_email       TEXT,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM verificacion_asistencia_registro r
      JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
      JOIN unidades u ON u.id = qa.unidad_id
     WHERE r.asamblea_id = p_asamblea_id
       AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
       AND (
         LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
         OR unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), p_email)
       )
       AND r.creado_en >= (
         SELECT s.apertura_at
         FROM verificacion_asamblea_sesiones s
         WHERE s.asamblea_id = p_asamblea_id
           AND s.cierre_at IS NULL
         ORDER BY s.apertura_at DESC
         LIMIT 1
       )
  );
END;
$$;

COMMENT ON FUNCTION ya_verifico_asistencia(UUID, TEXT, UUID) IS
  'True si el votante tiene verificación en la sesión actual (solo desde última apertura).';

-- 4. calcular_verificacion_quorum_desglose: opción solo sesión actual
CREATE OR REPLACE FUNCTION calcular_verificacion_quorum_desglose(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL,
  p_solo_sesion_actual BOOLEAN DEFAULT false
)
RETURNS TABLE (
  total_verificados       INT,
  coeficiente_directo     NUMERIC(12, 6),
  coeficiente_poder       NUMERIC(12, 6),
  coeficiente_total       NUMERIC(12, 6),
  coef_total_conjunto     NUMERIC(12, 6),
  porcentaje_total        NUMERIC(6, 2),
  porcentaje_directo      NUMERIC(6, 2),
  porcentaje_poder        NUMERIC(6, 2),
  quorum_alcanzado        BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
  v_coef_directo    NUMERIC(12, 6);
  v_coef_poder      NUMERIC(12, 6);
  v_corte           TIMESTAMPTZ;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF p_solo_sesion_actual THEN
    SELECT s.apertura_at INTO v_corte
    FROM verificacion_asamblea_sesiones s
    WHERE s.asamblea_id = p_asamblea_id
      AND s.cierre_at IS NULL
    ORDER BY s.apertura_at DESC
    LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_is_demo;

  WITH clasificado AS (
    SELECT
      r.quorum_asamblea_id,
      u.coeficiente,
      CASE
        WHEN unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), qa.email_propietario) THEN true
        WHEN EXISTS (
          SELECT 1 FROM poderes p
          WHERE p.unidad_otorgante_id = qa.unidad_id
            AND p.asamblea_id = p_asamblea_id
            AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(qa.email_propietario))
            AND p.estado = 'activo'
        ) THEN false
        ELSE true
      END AS es_directo
    FROM verificacion_asistencia_registro r
    JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE r.asamblea_id = p_asamblea_id
      AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
      AND (NOT p_solo_sesion_actual OR (v_corte IS NOT NULL AND r.creado_en >= v_corte))
  )
  SELECT
    COALESCE(SUM(CASE WHEN es_directo THEN coeficiente ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT es_directo THEN coeficiente ELSE 0 END), 0)
    INTO v_coef_directo, v_coef_poder
  FROM clasificado;

  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT r.quorum_asamblea_id)::INT
       FROM verificacion_asistencia_registro r
       JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
      WHERE r.asamblea_id = p_asamblea_id
        AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
        AND (NOT p_solo_sesion_actual OR (v_corte IS NOT NULL AND r.creado_en >= v_corte))),
    COALESCE(v_coef_directo, 0),
    COALESCE(v_coef_poder, 0),
    COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0),
    v_coef_total,
    CASE WHEN v_coef_total > 0 THEN ROUND((COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_directo, 0) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_poder, 0) / v_coef_total * 100, 2) ELSE 0 END,
    (v_coef_total > 0 AND (COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100 > 50);
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum_desglose(UUID, UUID, BOOLEAN) IS
  'Desglose verificación. Si p_solo_sesion_actual=true solo cuenta la sesión actual.';
