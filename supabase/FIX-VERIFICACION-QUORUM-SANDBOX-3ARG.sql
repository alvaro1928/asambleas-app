-- ============================================================
-- FIX-VERIFICACION-QUORUM-SANDBOX-3ARG.sql
--
-- La versión de 3 argumentos de calcular_verificacion_quorum
-- (p_asamblea_id, p_pregunta_id, p_solo_sesion_actual) es la que
-- usa el frontend y el trigger al cerrar sesión. Debe respetar
-- sandbox_usar_unidades_reales igual que la versión de 1 arg y
-- que calcular_quorum_asamblea.
--
-- Lógica:
--   is_demo=false                    → unidades is_demo=false (reales)
--   is_demo=true, sandbox_reales=false → unidades is_demo=true  (10 demo)
--   is_demo=true, sandbox_reales=true  → unidades is_demo=false (reales)
--
-- EJECUTAR en Supabase → SQL Editor → Run
-- ============================================================

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
  v_sandbox_reales  BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
  v_corte           TIMESTAMPTZ;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
    INTO v_organization_id, v_is_demo, v_sandbox_reales
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Misma lógica que calcular_quorum_asamblea: sandbox puede usar unidades reales
  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

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
     AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

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
   AND u.organization_id = v_organization_id
   AND COALESCE(u.is_demo, false) = v_unidades_is_demo
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND (NOT p_solo_sesion_actual OR (v_corte IS NOT NULL AND r.creado_en >= v_corte));
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum(UUID, UUID, BOOLEAN) IS
  'Calcula verificación (opcional por pregunta, opcional solo sesión actual). Respeta sandbox_usar_unidades_reales igual que calcular_quorum_asamblea.';
