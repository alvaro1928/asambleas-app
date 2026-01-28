-- =====================================================
-- ESTADÍSTICAS MEJORADAS CON LEY 675
-- =====================================================
-- Según la Ley 675, el porcentaje debe calcularse sobre
-- el COEFICIENTE TOTAL del conjunto (100%), no solo
-- sobre los que ya votaron
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
  -- Obtener organization_id de la pregunta
  SELECT a.organization_id INTO v_organization_id
  FROM preguntas p
  JOIN asambleas a ON a.id = p.asamblea_id
  WHERE p.id = p_pregunta_id;

  -- Calcular coeficiente TOTAL del conjunto (debería ser 100%)
  SELECT COALESCE(SUM(u.coeficiente), 100) INTO v_coeficiente_conjunto
  FROM unidades u
  WHERE u.organization_id = v_organization_id;

  -- Contar total de votos emitidos
  SELECT COUNT(DISTINCT v.id) INTO v_total_votos
  FROM votos v WHERE v.pregunta_id = p_pregunta_id;

  -- Sumar coeficientes de los que YA votaron
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
      -- Porcentaje sobre votos emitidos (útil en tiempo real)
      'porcentaje_votos_emitidos', COALESCE(
        CASE WHEN v_total_votos > 0 THEN 
          ROUND((stats.votos_count::NUMERIC / v_total_votos * 100), 2)
        ELSE 0 END, 0
      ),
      -- Porcentaje sobre coeficientes emitidos
      'porcentaje_coeficiente_emitido', COALESCE(
        CASE WHEN v_total_coeficiente > 0 THEN 
          ROUND((stats.votos_coeficiente / v_total_coeficiente * 100), 2)
        ELSE 0 END, 0
      ),
      -- ⭐ IMPORTANTE LEY 675: Porcentaje sobre coeficiente TOTAL del conjunto
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

  -- Retornar todos los datos
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

COMMENT ON FUNCTION calcular_estadisticas_pregunta IS 'Calcula estadísticas según Ley 675 (porcentaje sobre coeficiente total del conjunto)';

-- =====================================================
-- EJEMPLOS DE USO
-- =====================================================

-- Ver estadísticas de una pregunta:
-- SELECT * FROM calcular_estadisticas_pregunta('id-pregunta');

-- Interpretar resultados:
-- {
--   "total_votos": 5,                    <- 5 unidades votaron
--   "total_coeficiente": 15.5,           <- Suman 15.5% del total
--   "coeficiente_total_conjunto": 100,   <- Total del conjunto
--   "porcentaje_participacion": 15.50,   <- 15.5% de participación
--   "resultados": [
--     {
--       "opcion_texto": "A favor",
--       "votos_cantidad": 3,
--       "votos_coeficiente": 10.5,
--       "porcentaje_votos_emitidos": 60.00,        <- 60% de los que votaron
--       "porcentaje_coeficiente_emitido": 67.74,   <- 67.74% del coeficiente emitido
--       "porcentaje_coeficiente_total": 10.50      <- ⭐ 10.5% del TOTAL (Ley 675)
--     }
--   ]
-- }

-- Para aprobar una moción según Ley 675:
-- - Mayoría simple: > 50% del coeficiente_total_conjunto
-- - Mayoría calificada: > 70% del coeficiente_total_conjunto
-- Usar: porcentaje_coeficiente_total de cada opción

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT 'Función mejorada con Ley 675 ✅' as status;
