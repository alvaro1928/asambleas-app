-- Corregir cálculo de coeficiente votante en quórum
-- BUG: SUM(DISTINCT u.coeficiente) daba 12.5% cuando 6 unidades de 12.5% votaban
--      porque DISTINCT devolvía solo un valor. Debe sumar el coeficiente de CADA unidad que votó.
-- Ejecutar en Supabase: SQL Editor → pegar y Run

CREATE OR REPLACE FUNCTION calcular_quorum_asamblea(p_asamblea_id UUID)
RETURNS TABLE (
  total_unidades INTEGER,
  unidades_votantes INTEGER,
  unidades_pendientes INTEGER,
  coeficiente_total NUMERIC(12, 6),
  coeficiente_votante NUMERIC(12, 6),
  coeficiente_pendiente NUMERIC(12, 6),
  porcentaje_participacion_nominal NUMERIC(5, 2),
  porcentaje_participacion_coeficiente NUMERIC(5, 2),
  quorum_alcanzado BOOLEAN
) AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo BOOLEAN;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
  INTO v_organization_id, v_is_demo
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  RETURN QUERY
  WITH unidades_conjunto AS (
    SELECT 
      COUNT(*)::INTEGER AS total,
      COALESCE(SUM(coeficiente), 0) AS coef_total
    FROM unidades
    WHERE organization_id = v_organization_id
      AND is_demo = v_is_demo
  ),
  unidades_que_votaron AS (
    SELECT DISTINCT v.unidad_id
    FROM votos v
    JOIN preguntas p ON v.pregunta_id = p.id
    WHERE p.asamblea_id = p_asamblea_id
  ),
  unidades_votantes_data AS (
    SELECT 
      COUNT(*)::INTEGER AS votantes,
      COALESCE(SUM(u.coeficiente), 0) AS coef_votante
    FROM unidades_que_votaron uqv
    JOIN unidades u ON u.id = uqv.unidad_id
      AND u.organization_id = v_organization_id
      AND u.is_demo = v_is_demo
  )
  SELECT 
    uc.total AS total_unidades,
    COALESCE(uv.votantes, 0) AS unidades_votantes,
    (uc.total - COALESCE(uv.votantes, 0)) AS unidades_pendientes,
    uc.coef_total AS coeficiente_total,
    COALESCE(uv.coef_votante, 0)::NUMERIC(12, 6) AS coeficiente_votante,
    (uc.coef_total - COALESCE(uv.coef_votante, 0))::NUMERIC(12, 6) AS coeficiente_pendiente,
    CASE 
      WHEN uc.total > 0 THEN 
        ROUND((COALESCE(uv.votantes, 0)::NUMERIC / uc.total::NUMERIC * 100), 2)
      ELSE 0
    END AS porcentaje_participacion_nominal,
    CASE 
      WHEN uc.coef_total > 0 THEN 
        ROUND((COALESCE(uv.coef_votante, 0) / uc.coef_total * 100)::NUMERIC, 2)
      ELSE 0
    END AS porcentaje_participacion_coeficiente,
    CASE 
      WHEN uc.coef_total > 0 THEN 
        (COALESCE(uv.coef_votante, 0) / uc.coef_total * 100) >= 50
      ELSE false
    END AS quorum_alcanzado
  FROM unidades_conjunto uc
  LEFT JOIN unidades_votantes_data uv ON true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_quorum_asamblea IS 'Calcula el quórum en tiempo real. Coeficiente votante = suma del coeficiente de cada unidad que votó (no SUM DISTINCT).';
