-- =====================================================
-- Actualizar calcular_estadisticas_pregunta
-- Para que la gráfica muestre correctamente "X votos"
-- (incluye votos_cantidad en el JSON de resultados)
-- =====================================================
-- Ejecutar en Supabase: SQL Editor → pegar y Run
-- =====================================================

DROP FUNCTION IF EXISTS calcular_estadisticas_pregunta(UUID);

CREATE OR REPLACE FUNCTION calcular_estadisticas_pregunta(p_pregunta_id UUID)
RETURNS TABLE (
  total_votos INTEGER,
  total_coeficiente NUMERIC(12, 6),
  coeficiente_total_conjunto NUMERIC(12, 6),
  porcentaje_participacion NUMERIC(5, 2),
  resultados JSONB
) AS $$
DECLARE
  v_total_votos INTEGER;
  v_total_coeficiente NUMERIC(12, 6);
  v_coeficiente_conjunto NUMERIC(12, 6);
  v_organization_id UUID;
  v_resultados JSONB;
BEGIN
  SELECT a.organization_id INTO v_organization_id
  FROM preguntas p
  JOIN asambleas a ON a.id = p.asamblea_id
  WHERE p.id = p_pregunta_id;

  SELECT COALESCE(SUM(u.coeficiente), 100) INTO v_coeficiente_conjunto
  FROM unidades u
  WHERE u.organization_id = v_organization_id;

  SELECT COUNT(DISTINCT v.id) INTO v_total_votos
  FROM votos v WHERE v.pregunta_id = p_pregunta_id;

  SELECT COALESCE(SUM(u.coeficiente), 0) INTO v_total_coeficiente
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id
  WHERE v.pregunta_id = p_pregunta_id;

  -- resultados incluye votos_cantidad para que la gráfica muestre "X votos" correctamente
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'opcion_id', op.id,
      'opcion_texto', op.texto_opcion,
      'color', op.color,
      'votos_cantidad', COALESCE(stats.votos_count, 0),
      'votos_coeficiente', COALESCE(stats.votos_coeficiente, 0),
      'porcentaje_votos_emitidos', COALESCE(
        CASE WHEN v_total_votos > 0 THEN
          ROUND((stats.votos_count::NUMERIC / v_total_votos * 100), 2)
        ELSE 0 END, 0
      ),
      'porcentaje_coeficiente_emitido', COALESCE(
        CASE WHEN v_total_coeficiente > 0 THEN
          ROUND((stats.votos_coeficiente / v_total_coeficiente * 100), 2)
        ELSE 0 END, 0
      ),
      'porcentaje_coeficiente_total', COALESCE(
        CASE WHEN v_coeficiente_conjunto > 0 THEN
          ROUND((stats.votos_coeficiente / v_coeficiente_conjunto * 100), 2)
        ELSE 0 END, 0
      )
    ) ORDER BY op.orden
  ) INTO v_resultados
  FROM opciones_pregunta op
  LEFT JOIN (
    SELECT
      v.opcion_id,
      COUNT(v.id)::INTEGER AS votos_count,
      SUM(u.coeficiente)::NUMERIC(12, 6) AS votos_coeficiente
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id
    WHERE v.pregunta_id = p_pregunta_id
    GROUP BY v.opcion_id
  ) stats ON stats.opcion_id = op.id
  WHERE op.pregunta_id = p_pregunta_id;

  IF v_resultados IS NULL THEN v_resultados := '[]'::JSONB; END IF;

  RETURN QUERY SELECT
    v_total_votos,
    v_total_coeficiente,
    v_coeficiente_conjunto,
    CASE WHEN v_coeficiente_conjunto > 0 THEN
      ROUND((v_total_coeficiente / v_coeficiente_conjunto * 100), 2)
    ELSE 0 END AS porcentaje_participacion,
    v_resultados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calcular_estadisticas_pregunta(UUID) IS
  'Estadísticas por pregunta (Ley 675). Incluye votos_cantidad en resultados para gráfica y acta.';

-- Comprobar que existe
SELECT 'OK: calcular_estadisticas_pregunta actualizada (votos_cantidad en resultados)' AS status
WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calcular_estadisticas_pregunta');
