-- =====================================================
-- CORREGIR FUNCIÓN DE ESTADÍSTICAS DE VOTACIÓN
-- =====================================================
-- Esta función devuelve las estadísticas en el formato
-- correcto que espera el frontend
-- =====================================================

DROP FUNCTION IF EXISTS calcular_estadisticas_pregunta(UUID);

CREATE OR REPLACE FUNCTION calcular_estadisticas_pregunta(p_pregunta_id UUID)
RETURNS TABLE (
  total_votos INTEGER,
  total_coeficiente NUMERIC(12, 6),
  resultados JSONB
) AS $$
DECLARE
  v_total_votos INTEGER;
  v_total_coeficiente NUMERIC(12, 6);
  v_resultados JSONB;
BEGIN
  -- Contar total de votos
  SELECT COUNT(DISTINCT v.id) INTO v_total_votos
  FROM votos v
  WHERE v.pregunta_id = p_pregunta_id;

  -- Sumar total de coeficientes
  SELECT COALESCE(SUM(u.coeficiente), 0) INTO v_total_coeficiente
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id
  WHERE v.pregunta_id = p_pregunta_id;

  -- Calcular estadísticas por opción
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'opcion_id', op.id,
      'opcion_texto', op.texto_opcion,
      'color', op.color,
      'votos_cantidad', COALESCE(stats.votos_count, 0),
      'votos_coeficiente', COALESCE(stats.votos_coeficiente, 0),
      'porcentaje_cantidad', COALESCE(
        CASE 
          WHEN v_total_votos > 0 THEN (stats.votos_count::NUMERIC / v_total_votos * 100)
          ELSE 0
        END, 0
      ),
      'porcentaje_coeficiente', COALESCE(
        CASE 
          WHEN v_total_coeficiente > 0 THEN (stats.votos_coeficiente / v_total_coeficiente * 100)
          ELSE 0
        END, 0
      )
    )
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

  -- Si no hay resultados, crear array vacío
  IF v_resultados IS NULL THEN
    v_resultados := '[]'::JSONB;
  END IF;

  -- Retornar resultado
  RETURN QUERY
  SELECT 
    v_total_votos,
    v_total_coeficiente,
    v_resultados;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_estadisticas_pregunta IS 'Calcula estadísticas en tiempo real de una pregunta con formato JSON';

-- =====================================================
-- VERIFICAR QUE FUNCIONÓ
-- =====================================================
-- Puedes probar la función con una pregunta real:
-- SELECT * FROM calcular_estadisticas_pregunta('id-de-tu-pregunta');

-- Ver todas las preguntas para obtener un ID:
SELECT 
  p.id,
  p.texto_pregunta,
  COUNT(v.id) as votos_registrados
FROM preguntas p
LEFT JOIN votos v ON v.pregunta_id = p.id
GROUP BY p.id, p.texto_pregunta
ORDER BY p.created_at DESC;
