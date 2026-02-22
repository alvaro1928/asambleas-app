-- Sandbox: opción para usar unidades de demostración (10) o unidades reales del conjunto.
-- Solo aplica a asambleas con is_demo = true. Las asambleas productivas no se ven afectadas.
-- Ejecutar en Supabase: SQL Editor → pegar y Run

-- Columna en asambleas (solo relevante cuando is_demo = true)
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS sandbox_usar_unidades_reales BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN asambleas.sandbox_usar_unidades_reales IS 'Solo para asambleas demo: si true, quórum y estadísticas usan unidades reales del conjunto en lugar de las 10 unidades de demostración.';

-- =====================================================
-- Quórum: en sandbox con sandbox_usar_unidades_reales usar unidades reales
-- =====================================================
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
  v_sandbox_reales BOOLEAN;
  v_unidades_is_demo BOOLEAN;  -- qué unidades contar: true = demo, false = reales
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  -- Asambleas reales: solo unidades reales. Sandbox: por defecto demo; si sandbox_usar_unidades_reales entonces reales.
  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  RETURN QUERY
  WITH unidades_conjunto AS (
    SELECT
      COUNT(*)::INTEGER AS total,
      COALESCE(SUM(coeficiente), 0) AS coef_total
    FROM unidades
    WHERE organization_id = v_organization_id
      AND is_demo = v_unidades_is_demo
  ),
  unidades_votantes_data AS (
    SELECT
      COUNT(DISTINCT v.unidad_id)::INTEGER AS votantes,
      COALESCE(SUM(DISTINCT u.coeficiente), 0) AS coef_votante
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
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

COMMENT ON FUNCTION calcular_quorum_asamblea IS 'Quórum en tiempo real. Asambleas reales: solo unidades is_demo=false. Sandbox: por defecto unidades demo; si sandbox_usar_unidades_reales entonces unidades reales.';

-- =====================================================
-- Estadísticas por pregunta: mismo criterio de unidades
-- =====================================================
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
  v_sandbox_reales BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_tipo_votacion TEXT;
  v_total_votos INTEGER;
  v_total_coeficiente NUMERIC(12, 6);
  v_coeficiente_conjunto NUMERIC(12, 6);
  v_total_unidades INTEGER;
  v_resultados JSONB;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM preguntas p
  JOIN asambleas a ON a.id = p.asamblea_id
  WHERE p.id = p_pregunta_id;

  v_unidades_is_demo := CASE WHEN v_is_demo AND v_sandbox_reales THEN false ELSE v_is_demo END;

  SELECT COALESCE(p.tipo_votacion, 'coeficiente')
  INTO v_tipo_votacion
  FROM preguntas p
  WHERE p.id = p_pregunta_id;

  SELECT COUNT(*)::INTEGER
  INTO v_total_unidades
  FROM unidades
  WHERE organization_id = v_organization_id
    AND is_demo = v_unidades_is_demo;

  SELECT COALESCE(SUM(coeficiente), 100)
  INTO v_coeficiente_conjunto
  FROM unidades
  WHERE organization_id = v_organization_id
    AND is_demo = v_unidades_is_demo;

  SELECT COUNT(v.id)::INTEGER
  INTO v_total_votos
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
  WHERE v.pregunta_id = p_pregunta_id;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_total_coeficiente
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
  WHERE v.pregunta_id = p_pregunta_id;

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
    JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
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
  'Estadísticas por pregunta. Sandbox puede usar unidades reales si sandbox_usar_unidades_reales. Asambleas reales solo unidades reales.';

-- =====================================================
-- validar_votante_asamblea: en sandbox filtrar por unidades demo o reales
-- =====================================================
CREATE OR REPLACE FUNCTION validar_votante_asamblea(
  p_codigo_asamblea TEXT,
  p_email_votante TEXT
)
RETURNS TABLE (
  puede_votar BOOLEAN,
  unidades_propias UUID[],
  unidades_poderes UUID[],
  total_unidades INT,
  total_coeficiente NUMERIC,
  mensaje TEXT
) AS $$
DECLARE
  v_asamblea_id UUID;
  v_organization_id UUID;
  v_is_demo BOOLEAN;
  v_sandbox_reales BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_total_coef NUMERIC;
  v_identificador TEXT := LOWER(TRIM(p_email_votante));
  v_telefono_norm TEXT;
  v_es_email BOOLEAN := (v_identificador LIKE '%@%');
BEGIN
  SELECT asamblea_id, organization_id INTO v_asamblea_id, v_organization_id
  FROM validar_codigo_acceso(p_codigo_asamblea)
  WHERE acceso_valido = true;

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID[], NULL::UUID[], 0, 0::NUMERIC, 'Código de asamblea inválido'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = v_asamblea_id;

  v_unidades_is_demo := CASE WHEN v_is_demo AND v_sandbox_reales THEN false ELSE v_is_demo END;

  IF v_es_email THEN
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = v_unidades_is_demo
      AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = v_identificador;
  ELSE
    v_telefono_norm := normalizar_telefono(p_email_votante);
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = v_unidades_is_demo
      AND v_telefono_norm IS NOT NULL
      AND normalizar_telefono(COALESCE(u.telefono, u.telefono_propietario, '')) = v_telefono_norm;
  END IF;

  IF v_es_email THEN
    SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
    FROM poderes p
    JOIN unidades u ON u.id = p.unidad_otorgante_id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
    WHERE p.asamblea_id = v_asamblea_id
      AND p.estado = 'activo'
      AND LOWER(TRIM(p.email_receptor)) = v_identificador;
  END IF;

  IF v_unidades_propias IS NULL AND v_unidades_poderes IS NULL THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID[],
      NULL::UUID[],
      0,
      0::NUMERIC,
      'No hay unidades ni poderes registrados con ese email o teléfono en este conjunto'::TEXT;
    RETURN;
  END IF;

  IF v_unidades_propias IS NOT NULL THEN
    INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
    SELECT v_asamblea_id, u.id, p_email_votante, true
    FROM unnest(v_unidades_propias) AS u(id)
    ON CONFLICT (asamblea_id, unidad_id) DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
  END IF;
  IF v_unidades_poderes IS NOT NULL THEN
    INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
    SELECT v_asamblea_id, u.id, p_email_votante, true
    FROM unnest(v_unidades_poderes) AS u(id)
    ON CONFLICT (asamblea_id, unidad_id) DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
  END IF;

  SELECT COALESCE(SUM(coeficiente), 0) INTO v_total_coef
  FROM unidades
  WHERE id = ANY(COALESCE(v_unidades_propias, ARRAY[]::UUID[]) || COALESCE(v_unidades_poderes, ARRAY[]::UUID[]));

  RETURN QUERY SELECT
    true,
    COALESCE(v_unidades_propias, ARRAY[]::UUID[]),
    COALESCE(v_unidades_poderes, ARRAY[]::UUID[]),
    COALESCE(array_length(v_unidades_propias, 1), 0) + COALESCE(array_length(v_unidades_poderes, 1), 0),
    v_total_coef,
    'Votante válido'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_votante_asamblea(TEXT, TEXT) IS 'Valida votante por email o teléfono. En sandbox usa unidades demo o reales según sandbox_usar_unidades_reales.';
