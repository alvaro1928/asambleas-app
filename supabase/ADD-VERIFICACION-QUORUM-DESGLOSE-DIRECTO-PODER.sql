-- ============================================================
-- Desglose de verificación de quórum: directos vs por poder
-- Para mostrar en acceso: "Quórum 20%, 5% directos, 4% por poder"
-- ============================================================

CREATE OR REPLACE FUNCTION calcular_verificacion_quorum_desglose(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL
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
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_is_demo;

  -- Una fila es "directo" si el dueño de la unidad coincide con email en quorum; si no, "poder" si hay poder activo
  WITH clasificado AS (
    SELECT
      r.quorum_asamblea_id,
      u.coeficiente,
      CASE
        WHEN LOWER(TRIM(COALESCE(u.email_propietario, u.email, ''))) = LOWER(TRIM(qa.email_propietario)) THEN true
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
        AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)),
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

COMMENT ON FUNCTION calcular_verificacion_quorum_desglose(UUID, UUID) IS
  'Desglose de verificación: total, coeficiente/porcentaje directos (propietario) y por poder.';
