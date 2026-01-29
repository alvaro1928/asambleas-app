-- =====================================================
-- ACTUALIZAR VALIDACIÓN PARA REGISTRAR ASISTENCIA (QUÓRUM)
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
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_total_coef NUMERIC;
  v_unidad_id UUID;
BEGIN
  -- Validar código de asamblea
  SELECT asamblea_id, organization_id INTO v_asamblea_id, v_organization_id
  FROM validar_codigo_acceso(p_codigo_asamblea)
  WHERE acceso_valido = true;

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY
    SELECT 
      false AS puede_votar,
      NULL::UUID[],
      NULL::UUID[],
      0 AS total_unidades,
      0::NUMERIC AS total_coeficiente,
      'Código de asamblea inválido' AS mensaje;
    RETURN;
  END IF;

  -- Buscar unidades propias (donde el email coincide)
  SELECT ARRAY_AGG(id)
  INTO v_unidades_propias
  FROM unidades
  WHERE organization_id = v_organization_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(p_email_votante));

  -- Buscar unidades con poderes activos
  SELECT ARRAY_AGG(p.unidad_otorgante_id)
  INTO v_unidades_poderes
  FROM poderes p
  WHERE p.asamblea_id = v_asamblea_id
    AND p.estado = 'activo'
    AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(p_email_votante));

  -- Si no tiene unidades propias ni poderes
  IF v_unidades_propias IS NULL AND v_unidades_poderes IS NULL THEN
    RETURN QUERY
    SELECT 
      false AS puede_votar,
      NULL::UUID[],
      NULL::UUID[],
      0 AS total_unidades,
      0::NUMERIC AS total_coeficiente,
      'Este email no tiene unidades ni poderes registrados en este conjunto' AS mensaje;
    RETURN;
  END IF;

  -- =====================================================
  -- NUEVO: REGISTRAR EN QUÓRUM (Asistencia Virtual)
  -- =====================================================
  -- Registrar todas las unidades propias en el quórum
  IF v_unidades_propias IS NOT NULL THEN
    FOREACH v_unidad_id IN ARRAY v_unidades_propias
    LOOP
      INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
      SELECT v_asamblea_id, v_unidad_id, p_email_votante, true
      ON CONFLICT (asamblea_id, unidad_id) 
      DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
    END LOOP;
  END IF;

  -- Registrar todas las unidades representadas por poder en el quórum
  IF v_unidades_poderes IS NOT NULL THEN
    FOREACH v_unidad_id IN ARRAY v_unidades_poderes
    LOOP
      INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
      SELECT v_asamblea_id, v_unidad_id, p_email_votante, true
      ON CONFLICT (asamblea_id, unidad_id) 
      DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
    END LOOP;
  END IF;
  -- =====================================================

  -- Calcular coeficiente total
  SELECT COALESCE(SUM(coeficiente), 0)
  INTO v_total_coef
  FROM unidades
  WHERE id = ANY(COALESCE(v_unidades_propias, ARRAY[]::UUID[]) || COALESCE(v_unidades_poderes, ARRAY[]::UUID[]));

  -- Todo OK
  RETURN QUERY
  SELECT 
    true AS puede_votar,
    COALESCE(v_unidades_propias, ARRAY[]::UUID[]) AS unidades_propias,
    COALESCE(v_unidades_poderes, ARRAY[]::UUID[]) AS unidades_poderes,
    COALESCE(array_length(v_unidades_propias, 1), 0) + COALESCE(array_length(v_unidades_poderes, 1), 0) AS total_unidades,
    v_total_coef AS total_coeficiente,
    'Votante válido' AS mensaje;
END;
$$ LANGUAGE plpgsql;
