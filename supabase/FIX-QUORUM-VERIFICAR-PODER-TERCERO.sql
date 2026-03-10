-- ============================================================
-- FIX: Verificación de asistencia con poder a terceros
-- El apoderado (email_receptor) debe poder verificar asistencia aunque
-- la fila en quorum_asamblea se haya creado con el email del propietario
-- (ON CONFLICT no actualiza email_propietario).
-- Extiende quorum_ids_para_verificar_asistencia para devolver también
-- los quorum_id donde el email es el apoderado (poderes.email_receptor).
-- ============================================================

CREATE OR REPLACE FUNCTION quorum_ids_para_verificar_asistencia(
  p_asamblea_id UUID,
  p_email       TEXT  -- correo o teléfono con el que entró el votante
)
RETURNS TABLE (quorum_id UUID)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_es_email BOOLEAN := (LOWER(TRIM(p_email)) LIKE '%@%');
  v_tel_norm TEXT := normalizar_telefono(p_email);
BEGIN
  IF v_es_email THEN
    -- Por correo: igualdad en quorum, correos de la unidad, O apoderado (poder a terceros)
    RETURN QUERY
    SELECT qa.id
    FROM quorum_asamblea qa
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE qa.asamblea_id = p_asamblea_id
      AND (
        LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
        OR unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), p_email)
      )
    UNION
    -- Poder a terceros: el email es el apoderado (email_receptor) de un poder activo para esa unidad
    SELECT qa.id
    FROM quorum_asamblea qa
    INNER JOIN poderes p ON p.asamblea_id = qa.asamblea_id
      AND p.unidad_otorgante_id = qa.unidad_id
      AND p.estado = 'activo'
      AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(p_email))
    WHERE qa.asamblea_id = p_asamblea_id;
  ELSE
    -- Por teléfono: normalizar y comparar con lo guardado en quorum o con teléfono(s) de la unidad
    IF v_tel_norm IS NULL OR v_tel_norm = '' THEN
      RETURN;
    END IF;
    RETURN QUERY
    SELECT qa.id
    FROM quorum_asamblea qa
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE qa.asamblea_id = p_asamblea_id
      AND (
        normalizar_telefono(COALESCE(TRIM(qa.email_propietario), '')) = v_tel_norm
        OR normalizar_telefono(COALESCE(u.telefono, u.telefono_propietario, '')) = v_tel_norm
      );
  END IF;
END;
$$;

COMMENT ON FUNCTION quorum_ids_para_verificar_asistencia(UUID, TEXT) IS
  'Ids de quorum_asamblea donde el identificador (correo o teléfono) puede registrar verificación de asistencia. Incluye propietario, múltiples correos por unidad y apoderado (poder a terceros).';

-- Asegurar filas en quorum para este email en esta asamblea (unidades propias + poderes).
-- Útil cuando el votante/apoderado verifica asistencia sin haber pasado antes por la pantalla de entrada.
CREATE OR REPLACE FUNCTION asegurar_quorum_para_identificador(
  p_asamblea_id UUID,
  p_email       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_identificador TEXT := LOWER(TRIM(p_email));
  v_es_email BOOLEAN := (v_identificador LIKE '%@%');
BEGIN
  IF NOT v_es_email OR p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_organization_id
  FROM asambleas WHERE id = p_asamblea_id;
  IF v_organization_id IS NULL THEN
    RETURN;
  END IF;

  SELECT ARRAY_AGG(id) INTO v_unidades_propias
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND unidad_email_coincide(COALESCE(u.email, u.email_propietario, ''), p_email);

  SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
  FROM poderes p
  WHERE p.asamblea_id = p_asamblea_id
    AND p.estado = 'activo'
    AND LOWER(TRIM(p.email_receptor)) = v_identificador;

  IF v_unidades_propias IS NOT NULL THEN
    INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
    SELECT p_asamblea_id, u.id, TRIM(p_email), true
    FROM unnest(v_unidades_propias) AS u(id)
    ON CONFLICT (asamblea_id, unidad_id) DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
  END IF;
  IF v_unidades_poderes IS NOT NULL THEN
    INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
    SELECT p_asamblea_id, u.id, TRIM(p_email), true
    FROM unnest(v_unidades_poderes) AS u(id)
    ON CONFLICT (asamblea_id, unidad_id) DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION asegurar_quorum_para_identificador(UUID, TEXT) IS
  'Crea/actualiza filas en quorum_asamblea para el email (unidades propias + poderes). Permite verificar asistencia aunque el votante no haya pasado por la pantalla de entrada.';
