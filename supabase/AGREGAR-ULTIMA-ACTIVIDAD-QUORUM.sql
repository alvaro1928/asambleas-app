-- =====================================================
-- Última actividad en quórum (heartbeat para sesiones activas)
-- =====================================================
-- Permite que el "Registro de Ingresos" solo muestre a quienes
-- tengan actividad reciente (ping cada 2 min desde la página de votar).
-- Quienes cierren sin disparar "salida" desaparecen tras ~5 min.
-- Ejecutar en Supabase SQL Editor después de MARCAR-SALIDA-QUORUM.sql
-- =====================================================

-- 1. Columna de última actividad
ALTER TABLE quorum_asamblea
  ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMP WITH TIME ZONE DEFAULT now();

COMMENT ON COLUMN quorum_asamblea.ultima_actividad IS 'Se actualiza con cada ping del votante; solo se muestran filas con actividad reciente (ej. últimos 5 min)';

-- 2. Rellenar filas existentes (para no excluirlas hasta que pasen 5 min)
UPDATE quorum_asamblea
SET ultima_actividad = hora_llegada
WHERE ultima_actividad IS NULL;

-- 3. Función para que la página de votar haga "ping" (actualiza ultima_actividad)
CREATE OR REPLACE FUNCTION actualizar_actividad_quorum(
  p_asamblea_id UUID,
  p_email_votante TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quorum_asamblea
  SET ultima_actividad = now()
  WHERE asamblea_id = p_asamblea_id
    AND LOWER(TRIM(email_propietario)) = LOWER(TRIM(p_email_votante))
    AND presente_virtual = true;
END;
$$;

COMMENT ON FUNCTION actualizar_actividad_quorum IS 'Actualiza ultima_actividad para el listado de sesiones activas (heartbeat desde /votar)';

GRANT EXECUTE ON FUNCTION actualizar_actividad_quorum(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION actualizar_actividad_quorum(UUID, TEXT) TO authenticated;

-- 4. Al entrar/reentrar, actualizar también ultima_actividad (validar_votante_asamblea)
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
  SELECT asamblea_id, organization_id INTO v_asamblea_id, v_organization_id
  FROM validar_codigo_acceso(p_codigo_asamblea)
  WHERE acceso_valido = true;

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY
    SELECT false AS puede_votar, NULL::UUID[], NULL::UUID[], 0 AS total_unidades, 0::NUMERIC AS total_coeficiente, 'Código de asamblea inválido' AS mensaje;
    RETURN;
  END IF;

  SELECT ARRAY_AGG(id) INTO v_unidades_propias
  FROM unidades
  WHERE organization_id = v_organization_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(p_email_votante));

  SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
  FROM poderes p
  WHERE p.asamblea_id = v_asamblea_id
    AND p.estado = 'activo'
    AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(p_email_votante));

  IF v_unidades_propias IS NULL AND v_unidades_poderes IS NULL THEN
    RETURN QUERY
    SELECT false AS puede_votar, NULL::UUID[], NULL::UUID[], 0 AS total_unidades, 0::NUMERIC AS total_coeficiente, 'Este email no tiene unidades ni poderes registrados en este conjunto' AS mensaje;
    RETURN;
  END IF;

  IF v_unidades_propias IS NOT NULL THEN
    FOREACH v_unidad_id IN ARRAY v_unidades_propias
    LOOP
      INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
      SELECT v_asamblea_id, v_unidad_id, p_email_votante, true
      ON CONFLICT (asamblea_id, unidad_id)
      DO UPDATE SET presente_virtual = true, hora_llegada = now(), ultima_actividad = now();
    END LOOP;
  END IF;

  IF v_unidades_poderes IS NOT NULL THEN
    FOREACH v_unidad_id IN ARRAY v_unidades_poderes
    LOOP
      INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
      SELECT v_asamblea_id, v_unidad_id, p_email_votante, true
      ON CONFLICT (asamblea_id, unidad_id)
      DO UPDATE SET presente_virtual = true, hora_llegada = now(), ultima_actividad = now();
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(coeficiente), 0) INTO v_total_coef
  FROM unidades
  WHERE id = ANY(COALESCE(v_unidades_propias, ARRAY[]::UUID[]) || COALESCE(v_unidades_poderes, ARRAY[]::UUID[]));

  RETURN QUERY
  SELECT true AS puede_votar,
    COALESCE(v_unidades_propias, ARRAY[]::UUID[]) AS unidades_propias,
    COALESCE(v_unidades_poderes, ARRAY[]::UUID[]) AS unidades_poderes,
    COALESCE(array_length(v_unidades_propias, 1), 0) + COALESCE(array_length(v_unidades_poderes, 1), 0) AS total_unidades,
    v_total_coef AS total_coeficiente,
    'Votante válido' AS mensaje;
END;
$$ LANGUAGE plpgsql;
