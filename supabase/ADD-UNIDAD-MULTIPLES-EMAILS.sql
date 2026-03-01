-- ============================================================
-- Unidad con múltiples correos: mismo voto por unidad
-- Si una unidad tiene varios correos (separados por , ; o espacios),
-- cualquiera de ellos identifica a la unidad; es un solo voto por unidad.
-- ============================================================

-- 1. Función auxiliar: true si identificador coincide con alguno de los correos del campo (separados por , ; o espacios)
CREATE OR REPLACE FUNCTION unidad_email_coincide(
  campo_email TEXT,
  identificador TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(COALESCE(TRIM(campo_email), ''), E'[,;\\s]+') AS t(token)
    WHERE LOWER(TRIM(t.token)) = LOWER(TRIM(identificador))
      AND LENGTH(TRIM(t.token)) > 0
  );
$$;

COMMENT ON FUNCTION unidad_email_coincide(TEXT, TEXT) IS
  'True si identificador (email) coincide con alguno de los valores en campo_email cuando hay varios separados por coma, punto y coma o espacios.';

-- 2. validar_votante_asamblea: unidades propias por email usando múltiples correos
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

  -- Unidades propias: por email (campo puede tener varios separados por , ; o espacio) o por teléfono
  IF v_es_email THEN
    SELECT ARRAY_AGG(id) INTO v_unidades_propias
    FROM unidades u
    WHERE u.organization_id = v_organization_id
      AND unidad_email_coincide(COALESCE(u.email, u.email_propietario, ''), p_email_votante);
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

COMMENT ON FUNCTION validar_votante_asamblea(TEXT, TEXT) IS
  'Valida votante por email o teléfono. Unidad puede tener varios correos (separados por , ; o espacio): cualquiera identifica la misma unidad (un voto por unidad).';

-- 3. ya_verifico_asistencia: considerar "ya verificó" si el email coincide con la unidad (incl. múltiples correos en la unidad)
CREATE OR REPLACE FUNCTION ya_verifico_asistencia(
  p_asamblea_id UUID,
  p_email       TEXT,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM verificacion_asistencia_registro r
      JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
      JOIN unidades u ON u.id = qa.unidad_id
     WHERE r.asamblea_id = p_asamblea_id
       AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
       AND (
         LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
         OR unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), p_email)
       )
  );
END;
$$;

COMMENT ON FUNCTION ya_verifico_asistencia(UUID, TEXT, UUID) IS
  'True si el votante (email) tiene verificación en el contexto. Considera múltiples correos por unidad.';

-- 4. calcular_verificacion_quorum_desglose: "directo" si el email en quorum coincide con alguno de los correos de la unidad
CREATE OR REPLACE FUNCTION calcular_verificacion_quorum_desglose(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_verificados       INT,
  coeficiente_directo     NUMERIC(12, 6),
  coeficiente_poder       NUMERIC(12, 6),
  coeficiente_total       NUMERIC(12, 6),
  coef_total_conjunto     NUMERIC(12, 6),
  porcentaje_total        NUMERIC(6, 2),
  porcentaje_directo      NUMERIC(6, 2),
  porcentaje_poder        NUMERIC(6, 2),
  quorum_alcanzado        BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
  v_coef_directo    NUMERIC(12, 6);
  v_coef_poder      NUMERIC(12, 6);
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_is_demo;

  -- Directo: email en quorum coincide con alguno de los correos de la unidad; si no, poder si hay poder activo
  WITH clasificado AS (
    SELECT
      r.quorum_asamblea_id,
      u.coeficiente,
      CASE
        WHEN unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), qa.email_propietario) THEN true
        WHEN EXISTS (
          SELECT 1 FROM poderes p
          WHERE p.unidad_otorgante_id = qa.unidad_id
            AND p.asamblea_id = p_asamblea_id
            AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(qa.email_propietario))
            AND p.estado = 'activo'
        ) THEN false
        ELSE true
      END AS es_directo
    FROM verificacion_asistencia_registro r
    JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE r.asamblea_id = p_asamblea_id
      AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
  )
  SELECT
    COALESCE(SUM(CASE WHEN es_directo THEN coeficiente ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT es_directo THEN coeficiente ELSE 0 END), 0)
    INTO v_coef_directo, v_coef_poder
  FROM clasificado;

  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT r.quorum_asamblea_id)::INT
       FROM verificacion_asistencia_registro r
       JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
      WHERE r.asamblea_id = p_asamblea_id
        AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)),
    COALESCE(v_coef_directo, 0),
    COALESCE(v_coef_poder, 0),
    COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0),
    v_coef_total,
    CASE WHEN v_coef_total > 0 THEN ROUND((COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_directo, 0) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_poder, 0) / v_coef_total * 100, 2) ELSE 0 END,
    (v_coef_total > 0 AND (COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100 > 50);
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum_desglose(UUID, UUID) IS
  'Desglose verificación: total, directos (propietario, incl. múltiples correos por unidad) y por poder.';

-- 5. RPC para la API verificar-asistencia: devuelve los quorum_asamblea.id donde este identificador (correo o teléfono) puede verificar
-- Requiere que exista normalizar_telefono (VALIDAR-VOTANTE-EMAIL-O-TELEFONO-UNIFICADO.sql)
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
    -- Por correo: igualdad en quorum o alguno de los correos de la unidad
    RETURN QUERY
    SELECT qa.id
    FROM quorum_asamblea qa
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE qa.asamblea_id = p_asamblea_id
      AND (
        LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
        OR unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), p_email)
      );
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
  'Ids de quorum_asamblea donde el identificador (correo o teléfono) puede registrar verificación de asistencia.';
