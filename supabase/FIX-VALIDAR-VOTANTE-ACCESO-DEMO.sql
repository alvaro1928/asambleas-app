-- =====================================================
-- FIX: Acceso con test1@...test10@ en asamblea de demostración
-- =====================================================
-- Si con "Unidades de demostración" no te deja entrar con test1@asambleas.online,
-- ejecuta en Supabase → SQL Editor → Run (en este orden):
-- 1) ASEGURAR-UNIDADES-DEMO-SANDBOX.sql (crea la función asegurar_unidades_demo_organizacion)
-- 2) Este script (FIX-VALIDAR-VOTANTE-ACCESO-DEMO.sql)
--
-- Las unidades demo son solo para sandbox y no se mezclan con las productivas.
-- =====================================================

-- 1. Columna (por si no existe)
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS sandbox_usar_unidades_reales BOOLEAN NOT NULL DEFAULT false;

-- 2. Todas las asambleas demo usan unidades de demostración (test1@...test10@)
UPDATE asambleas
SET sandbox_usar_unidades_reales = false
WHERE is_demo = true;

-- 3. Reemplazar la función para que en asambleas demo busque unidades is_demo = true
--    cuando sandbox_usar_unidades_reales = false
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

  -- Asamblea demo con sandbox_usar_unidades_reales = false → buscar unidades is_demo = true (test1@...test10@)
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

  -- Fallback: solo cuando la asamblea demo usa "Unidades de demostración" (no unidades reales).
  -- Si sandbox_usar_unidades_reales = true, test1@...test10@ NO deben tener acceso; solo cuentas de unidades reales.
  IF v_is_demo AND NOT v_sandbox_reales AND v_unidades_propias IS NULL AND v_unidades_poderes IS NULL
     AND v_es_email AND v_identificador ~ '^test[0-9]+@asambleas\.online$' THEN
    PERFORM asegurar_unidades_demo_organizacion(v_organization_id);
    v_unidades_is_demo := true;
    IF v_es_email THEN
      SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
      FROM unidades u
      WHERE u.organization_id = v_organization_id
        AND u.is_demo = true
        AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = v_identificador;
    END IF;
    IF v_es_email THEN
      SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
      FROM poderes p
      JOIN unidades u ON u.id = p.unidad_otorgante_id AND u.organization_id = v_organization_id AND u.is_demo = true
      WHERE p.asamblea_id = v_asamblea_id
        AND p.estado = 'activo'
        AND LOWER(TRIM(p.email_receptor)) = v_identificador;
    END IF;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validar_votante_asamblea(TEXT, TEXT) IS 'Valida votante por email o teléfono. En asambleas demo con sandbox_usar_unidades_reales=false usa unidades is_demo=true (test1@...test10@). SECURITY DEFINER para que RLS no bloquee la lectura de asambleas/unidades.';
