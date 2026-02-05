-- Excluir unidades de prueba (is_demo) del quórum en asambleas reales.
-- En asambleas reales solo cuentan unidades con is_demo = false.
-- En asambleas de demostración solo cuentan unidades con is_demo = true.
-- Así evita que en una asamblea real aparezcan 510 (500 + 10 demo) en lugar de 500.

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
  -- Obtener organization_id e is_demo de la asamblea
  SELECT a.organization_id, COALESCE(a.is_demo, false)
  INTO v_organization_id, v_is_demo
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  -- Calcular métricas de quórum solo con unidades del mismo tipo que la asamblea
  -- (reales para asamblea real, demo para asamblea demo)
  RETURN QUERY
  WITH unidades_conjunto AS (
    SELECT 
      COUNT(*)::INTEGER AS total,
      COALESCE(SUM(coeficiente), 0) AS coef_total
    FROM unidades
    WHERE organization_id = v_organization_id
      AND is_demo = v_is_demo
  ),
  unidades_votantes_data AS (
    SELECT 
      COUNT(DISTINCT v.unidad_id)::INTEGER AS votantes,
      COALESCE(SUM(DISTINCT u.coeficiente), 0) AS coef_votante
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_is_demo
    JOIN preguntas p ON v.pregunta_id = p.id
    WHERE p.asamblea_id = p_asamblea_id
  )
  SELECT 
    uc.total AS total_unidades,
    COALESCE(uv.votantes, 0) AS unidades_votantes,
    (uc.total - COALESCE(uv.votantes, 0)) AS unidades_pendientes,
    uc.coef_total AS coeficiente_total,
    COALESCE(uv.coef_votante, 0) AS coeficiente_votante,
    (uc.coef_total - COALESCE(uv.coef_votante, 0)) AS coeficiente_pendiente,
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

COMMENT ON FUNCTION calcular_quorum_asamblea IS 'Calcula el quórum en tiempo real; excluye unidades demo en asambleas reales e incluye solo unidades demo en asambleas de demostración.';
