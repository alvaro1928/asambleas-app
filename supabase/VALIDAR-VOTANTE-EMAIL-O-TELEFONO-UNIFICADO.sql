-- =====================================================
-- Validar votante por EMAIL o TELÉFONO (unidad o poder)
-- Compatible con columnas: email / email_propietario y telefono / telefono_propietario
-- Ejecutar en Supabase SQL Editor si la votación con teléfono no funciona
-- =====================================================

-- Asegurar columnas en unidades (diferentes proyectos usan email o email_propietario, telefono o telefono_propietario)
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS email_propietario TEXT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS telefono_propietario TEXT;

CREATE INDEX IF NOT EXISTS idx_unidades_telefono ON unidades(telefono) WHERE telefono IS NOT NULL AND telefono != '';

-- Función auxiliar: normalizar teléfono (solo dígitos, sin 57 inicial)
CREATE OR REPLACE FUNCTION normalizar_telefono(t TEXT)
RETURNS TEXT AS $$
BEGIN
  IF t IS NULL OR TRIM(t) = '' THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(regexp_replace(TRIM(t), '[^0-9]', '', 'g'), '^57', '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Reemplazar validar_votante_asamblea: acepta email O teléfono y usa email/email_propietario y telefono/telefono_propietario
CREATE OR REPLACE FUNCTION validar_votante_asamblea(
  p_codigo_asamblea TEXT,
  p_email_votante TEXT  -- identificador: email o teléfono
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
  v_identificador TEXT := LOWER(TRIM(p_email_votante));
  v_telefono_norm TEXT := normalizar_telefono(p_email_votante);
  v_es_email BOOLEAN := (v_identificador LIKE '%@%');
BEGIN
  SELECT asamblea_id, organization_id INTO v_asamblea_id, v_organization_id
  FROM validar_codigo_acceso(p_codigo_asamblea)
  WHERE acceso_valido = true;

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID[], NULL::UUID[], 0, 0::NUMERIC, 'Código de asamblea inválido'::TEXT;
    RETURN;
  END IF;

  -- Unidades propias: por email (email o email_propietario) O por teléfono (telefono o telefono_propietario)
  IF v_es_email THEN
    SELECT ARRAY_AGG(id) INTO v_unidades_propias
    FROM unidades u
    WHERE u.organization_id = v_organization_id
      AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = v_identificador;
  ELSE
    SELECT ARRAY_AGG(id) INTO v_unidades_propias
    FROM unidades u
    WHERE u.organization_id = v_organization_id
      AND v_telefono_norm IS NOT NULL
      AND normalizar_telefono(COALESCE(u.telefono, u.telefono_propietario, '')) = v_telefono_norm;
  END IF;

  -- Poderes: solo por email del receptor
  IF v_es_email THEN
    SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
    FROM poderes p
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

  -- Registrar asistencia en quórum
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

COMMENT ON FUNCTION validar_votante_asamblea IS 'Valida votante por email o teléfono; usa email/email_propietario y telefono/telefono_propietario en unidades';
