-- Corregir calcular_estadisticas_pregunta para excluir unidades demo en asambleas reales
-- y soportar votación NOMINAL (un voto por unidad) además de COEFICIENTE (Ley 675)
-- BUG coeficiente: Usaba todas las unidades (reales + demo) como denominador.
-- BUG nominal: No existía lógica; siempre devolvía coeficiente. Para nominal:
--   - porcentaje de cada opción = (votos opción / total unidades) * 100
--   - participación = (unidades que votaron / total unidades) * 100
-- Ejecutar en Supabase: SQL Editor → pegar y Run

DROP FUNCTION IF EXISTS calcular_estadisticas_pregunta(UUID);

CREATE OR REPLACE FUNCTION calcular_estadisticas_pregunta(p_pregunta_id UUID)
RETURNS TABLE (
  total_votos INTEGER,
  total_coeficiente NUMERIC(12, 6),
  coeficiente_total_conjunto NUMERIC(12, 6),
  total_unidades INTEGER,
  tipo_votacion TEXT,
  porcentaje_participacion NUMERIC(5, 2),
  resultados JSONB
) AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo BOOLEAN;
  v_tipo_votacion TEXT;
  v_total_votos INTEGER;
  v_total_coeficiente NUMERIC(12, 6);
  v_coeficiente_conjunto NUMERIC(12, 6);
  v_total_unidades INTEGER;
  v_resultados JSONB;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
  INTO v_organization_id, v_is_demo
  FROM preguntas p
  JOIN asambleas a ON a.id = p.asamblea_id
  WHERE p.id = p_pregunta_id;

  SELECT COALESCE(p.tipo_votacion, 'coeficiente')
  INTO v_tipo_votacion
  FROM preguntas p
  WHERE p.id = p_pregunta_id;

  -- Total de unidades del conjunto (reales o demo según asamblea)
  SELECT COUNT(*)::INTEGER
  INTO v_total_unidades
  FROM unidades
  WHERE organization_id = v_organization_id
    AND is_demo = v_is_demo;

  -- Solo unidades del mismo tipo que la asamblea (reales o demo)
  SELECT COALESCE(SUM(coeficiente), 100)
  INTO v_coeficiente_conjunto
  FROM unidades
  WHERE organization_id = v_organization_id
    AND is_demo = v_is_demo;

  SELECT COUNT(v.id)::INTEGER
  INTO v_total_votos
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_is_demo
  WHERE v.pregunta_id = p_pregunta_id;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_total_coeficiente
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_is_demo
  WHERE v.pregunta_id = p_pregunta_id;

  -- resultados: porcentaje_nominal_total para nominal (opción/total_unidades), porcentaje_coeficiente_total para coeficiente
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
      ),
      'porcentaje_nominal_total', COALESCE(
        CASE WHEN v_total_unidades > 0 THEN
          ROUND((COALESCE(stats.votos_count, 0)::NUMERIC / v_total_unidades * 100), 2)
        ELSE 0 END, 0
      )
    ) ORDER BY op.orden
  )
  INTO v_resultados
  FROM opciones_pregunta op
  LEFT JOIN (
    SELECT
      v.opcion_id,
      COUNT(v.id)::INTEGER AS votos_count,
      SUM(u.coeficiente)::NUMERIC(12, 6) AS votos_coeficiente
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_is_demo
    WHERE v.pregunta_id = p_pregunta_id
    GROUP BY v.opcion_id
  ) stats ON stats.opcion_id = op.id
  WHERE op.pregunta_id = p_pregunta_id;

  IF v_resultados IS NULL THEN v_resultados := '[]'::JSONB; END IF;

  RETURN QUERY SELECT
    v_total_votos,
    v_total_coeficiente,
    v_coeficiente_conjunto,
    v_total_unidades,
    v_tipo_votacion,
    -- participación: nominal = votos/total_unidades; coeficiente = coef/coef_conjunto
    CASE
      WHEN v_tipo_votacion = 'nominal' AND v_total_unidades > 0 THEN
        ROUND((v_total_votos::NUMERIC / v_total_unidades * 100), 2)
      WHEN v_tipo_votacion = 'coeficiente' AND v_coeficiente_conjunto > 0 THEN
        ROUND((v_total_coeficiente / v_coeficiente_conjunto * 100), 2)
      ELSE 0
    END AS porcentaje_participacion,
    v_resultados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calcular_estadisticas_pregunta(UUID) IS
  'Estadísticas por pregunta. Coeficiente: Ley 675 (%). Nominal: un voto por unidad (%). Excluye unidades demo en asambleas reales.';
