-- =====================================================
-- Registro público de poderes sin abrir votación (LOPD + pendiente_verificacion)
-- Ejecutar en Supabase SQL Editor después de dependencias (SESION-Y-TOKENS-CONSENTIMIENTO, etc.).
-- =====================================================

-- 1) Flag por asamblea: permite /registrar-poder/[codigo] y APIs de poder con código aunque acceso_publico = false
ALTER TABLE public.asambleas
  ADD COLUMN IF NOT EXISTS registro_poderes_publico BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.asambleas.registro_poderes_publico IS
  'Preferencia de administrador (destacar bloque / envío masivo). El portal /registrar-poder/[codigo] funciona con cualquier código de asamblea válido; no depende de este flag.';

-- 2) Validar código para /registrar-poder: acceso_valido si el código existe (secreto compartido por asamblea).
CREATE OR REPLACE FUNCTION public.validar_codigo_registro_poderes(p_codigo TEXT)
RETURNS TABLE (
  asamblea_id UUID,
  nombre TEXT,
  fecha DATE,
  organization_id UUID,
  nombre_conjunto TEXT,
  acceso_valido BOOLEAN,
  mensaje TEXT,
  participacion_timer_end_at TIMESTAMPTZ,
  participacion_timer_default_minutes INTEGER,
  participacion_timer_enabled BOOLEAN,
  session_mode TEXT,
  session_seq INTEGER,
  registro_poderes_publico BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_asamblea RECORD;
BEGIN
  SELECT
    a.id,
    a.nombre,
    a.fecha::DATE,
    a.organization_id,
    a.acceso_publico,
    COALESCE(a.registro_poderes_publico, false) AS registro_poderes_publico,
    COALESCE(o.name, 'Sin nombre') AS nombre_conjunto,
    a.participacion_timer_end_at,
    a.participacion_timer_default_minutes,
    a.participacion_timer_enabled,
    COALESCE(a.session_mode, 'inactive') AS session_mode,
    COALESCE(a.session_seq, 1) AS session_seq
  INTO v_asamblea
  FROM public.asambleas a
  LEFT JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo));

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      NULL::UUID, NULL::TEXT, NULL::DATE, NULL::UUID, NULL::TEXT,
      false, 'Código de acceso inválido o no existe'::TEXT,
      NULL::TIMESTAMPTZ, 5, true, 'inactive'::TEXT, 1,
      false::BOOLEAN;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_asamblea.id, v_asamblea.nombre, v_asamblea.fecha, v_asamblea.organization_id,
    v_asamblea.nombre_conjunto, true, 'Código válido. Acceso permitido.'::TEXT,
    v_asamblea.participacion_timer_end_at,
    COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
    COALESCE(v_asamblea.participacion_timer_enabled, true),
    v_asamblea.session_mode, v_asamblea.session_seq,
    COALESCE(v_asamblea.registro_poderes_publico, false);
END;
$$;

ALTER FUNCTION public.validar_codigo_registro_poderes(TEXT) SET row_security = off;

COMMENT ON FUNCTION public.validar_codigo_registro_poderes(TEXT) IS
  'Valida codigo_acceso para /registrar-poder: acceso_valido si la asamblea existe (código único como secreto compartido).';

GRANT EXECUTE ON FUNCTION public.validar_codigo_registro_poderes(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validar_codigo_registro_poderes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_codigo_registro_poderes(TEXT) TO service_role;

-- 3) Misma lógica que validar_votante_asamblea pero resuelve asamblea por código sin exigir solo acceso_publico; sin inserts en quorum_asamblea
CREATE OR REPLACE FUNCTION public.validar_votante_registro_poderes(
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT a.id, a.organization_id
  INTO v_asamblea_id, v_organization_id
  FROM public.asambleas a
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo_asamblea));

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID[], NULL::UUID[], 0, 0::NUMERIC, 'Código de asamblea inválido'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_is_demo, v_sandbox_reales
  FROM public.asambleas a
  WHERE a.id = v_asamblea_id;

  v_unidades_is_demo := CASE WHEN v_is_demo AND v_sandbox_reales THEN false ELSE v_is_demo END;

  IF v_es_email THEN
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM public.unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = v_unidades_is_demo
      AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = v_identificador;
  ELSE
    v_telefono_norm := public.normalizar_telefono(p_email_votante);
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM public.unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = v_unidades_is_demo
      AND v_telefono_norm IS NOT NULL
      AND public.normalizar_telefono(COALESCE(u.telefono, u.telefono_propietario, '')) = v_telefono_norm;
  END IF;

  IF v_es_email THEN
    SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
    FROM public.poderes p
    JOIN public.unidades u ON u.id = p.unidad_otorgante_id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
    WHERE p.asamblea_id = v_asamblea_id
      AND p.estado = 'activo'
      AND LOWER(TRIM(p.email_receptor)) = v_identificador;
  END IF;

  IF v_is_demo AND NOT v_sandbox_reales AND v_unidades_propias IS NULL AND v_unidades_poderes IS NULL
     AND v_es_email AND v_identificador ~ '^test[0-9]+@asambleas\.online$' THEN
    PERFORM public.asegurar_unidades_demo_organizacion(v_organization_id);
    v_unidades_is_demo := true;
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM public.unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = true
      AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = v_identificador;
    SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
    FROM public.poderes p
    JOIN public.unidades u ON u.id = p.unidad_otorgante_id AND u.organization_id = v_organization_id AND u.is_demo = true
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

  SELECT COALESCE(SUM(uni.coeficiente), 0) INTO v_total_coef
  FROM public.unidades uni
  WHERE uni.id = ANY(COALESCE(v_unidades_propias, ARRAY[]::UUID[]) || COALESCE(v_unidades_poderes, ARRAY[]::UUID[]));

  RETURN QUERY SELECT
    true,
    COALESCE(v_unidades_propias, ARRAY[]::UUID[]),
    COALESCE(v_unidades_poderes, ARRAY[]::UUID[]),
    COALESCE(array_length(v_unidades_propias, 1), 0) + COALESCE(array_length(v_unidades_poderes, 1), 0),
    v_total_coef,
    'Votante válido'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.validar_votante_registro_poderes(TEXT, TEXT) IS
  'Valida identificador para LOPD en portal de registro de poderes si el código de asamblea existe; no escribe quorum_asamblea.';

GRANT EXECUTE ON FUNCTION public.validar_votante_registro_poderes(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validar_votante_registro_poderes(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_votante_registro_poderes(TEXT, TEXT) TO service_role;

-- 4) LOPD + tokens para portal /registrar-poder (incl. apoderado externo sin censo: p_registro_externo)
DROP FUNCTION IF EXISTS public.registrar_consentimiento_registro_poderes(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.registrar_consentimiento_registro_poderes(
  p_codigo TEXT,
  p_identificador TEXT,
  p_ip TEXT DEFAULT NULL,
  p_registro_externo BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo TEXT := UPPER(TRIM(p_codigo));
  v_id_norm TEXT := LOWER(TRIM(p_identificador));
  v_asamblea RECORD;
  v_org UUID;
  v_demo BOOLEAN;
  v_seq INT;
  v_val RECORD;
  v_unidades UUID[];
  v_ord INT;
  v_tokens_unit INT;
  v_charge_total INT := 0;
  v_consent_id UUID;
  v_gestor_user UUID;
  v_owner_profile_id UUID;
  v_saldo INT;
  v_nuevo_saldo INT;
  v_n_existentes INT;
  u UUID;
BEGIN
  IF v_codigo IS NULL OR v_id_norm IS NULL OR length(v_id_norm) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST', 'message', 'Faltan codigo o identificador');
  END IF;

  SELECT
    a.id,
    a.organization_id,
    COALESCE(a.is_demo, false) AS is_demo,
    COALESCE(a.session_seq, 1) AS session_seq
  INTO v_asamblea
  FROM public.asambleas a
  WHERE a.codigo_acceso = v_codigo
  FOR UPDATE OF a;

  IF v_asamblea.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ASAMBLEA_NOT_FOUND', 'message', 'Código no válido');
  END IF;

  v_org := v_asamblea.organization_id;
  v_demo := v_asamblea.is_demo;
  v_seq := v_asamblea.session_seq;

  IF COALESCE(p_registro_externo, false) THEN
    v_unidades := ARRAY[]::UUID[];
    v_charge_total := 0;
    v_n_existentes := 0;
  ELSE
    SELECT * INTO v_val FROM public.validar_votante_registro_poderes(v_codigo, p_identificador) LIMIT 1;

    IF v_val.puede_votar IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VOTANTE_INVALIDO', 'message', COALESCE(v_val.mensaje, 'Votante no válido'));
    END IF;

    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::UUID[])
    INTO v_unidades
    FROM (
      SELECT DISTINCT unnest(
        COALESCE(v_val.unidades_propias, ARRAY[]::UUID[]) ||
        COALESCE(v_val.unidades_poderes, ARRAY[]::UUID[])
      ) AS id
    ) s;

    IF v_unidades IS NULL OR coalesce(array_length(v_unidades, 1), 0) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SIN_UNIDADES', 'message', 'No hay unidades para este identificador');
    END IF;

    SELECT o.owner_id INTO v_owner_profile_id FROM public.organizations o WHERE o.id = v_org;
    IF v_owner_profile_id IS NOT NULL THEN
      SELECT p.user_id INTO v_gestor_user FROM public.profiles p WHERE p.id = v_owner_profile_id LIMIT 1;
    END IF;
    IF v_gestor_user IS NULL THEN
      SELECT p.user_id INTO v_gestor_user
      FROM public.profiles p
      WHERE p.organization_id = v_org AND p.user_id IS NOT NULL
      ORDER BY p.created_at NULLS LAST
      LIMIT 1;
    END IF;

    SELECT COUNT(DISTINCT unidad_id)::INT INTO v_n_existentes
    FROM public.sesion_token_consumos
    WHERE asamblea_id = v_asamblea.id AND session_seq = v_seq;

    v_ord := v_n_existentes;
    v_charge_total := 0;

    FOREACH u IN ARRAY v_unidades LOOP
      IF EXISTS (
        SELECT 1 FROM public.sesion_token_consumos c
        WHERE c.asamblea_id = v_asamblea.id AND c.session_seq = v_seq AND c.unidad_id = u
      ) THEN
        CONTINUE;
      END IF;

      v_ord := v_ord + 1;
      IF v_demo THEN
        v_tokens_unit := 0;
      ELSE
        v_tokens_unit := CASE WHEN v_ord <= 5 THEN 0 ELSE 1 END;
      END IF;

      v_charge_total := v_charge_total + v_tokens_unit;
    END LOOP;

    IF NOT v_demo AND v_charge_total > 0 THEN
      IF v_gestor_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_GESTOR', 'message', 'No se encontró billetera del gestor para este conjunto.');
      END IF;

      PERFORM 1 FROM public.profiles p
      WHERE p.user_id = v_gestor_user OR p.id = v_gestor_user
      FOR UPDATE;

      SELECT COALESCE(MAX(p.tokens_disponibles), 0)::INT INTO v_saldo
      FROM public.profiles p
      WHERE p.user_id = v_gestor_user OR p.id = v_gestor_user;

      IF v_saldo < v_charge_total THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'INSUFFICIENT_TOKENS',
          'message', format('Saldo insuficiente: se requieren %s tokens y hay %s.', v_charge_total, v_saldo),
          'requerido', v_charge_total,
          'saldo', v_saldo
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.consentimiento_tratamiento_datos (asamblea_id, identificador, accepted_at, ip_address, session_seq)
  VALUES (v_asamblea.id, v_id_norm, now(), NULLIF(trim(p_ip), ''), v_seq)
  ON CONFLICT (asamblea_id, identificador, session_seq)
  DO UPDATE SET accepted_at = EXCLUDED.accepted_at, ip_address = COALESCE(EXCLUDED.ip_address, consentimiento_tratamiento_datos.ip_address)
  RETURNING id INTO v_consent_id;

  IF NOT COALESCE(p_registro_externo, false) THEN
    v_ord := v_n_existentes;

    FOREACH u IN ARRAY v_unidades LOOP
      IF EXISTS (
        SELECT 1 FROM public.sesion_token_consumos c
        WHERE c.asamblea_id = v_asamblea.id AND c.session_seq = v_seq AND c.unidad_id = u
      ) THEN
        CONTINUE;
      END IF;

      v_ord := v_ord + 1;
      IF v_demo THEN
        v_tokens_unit := 0;
      ELSE
        v_tokens_unit := CASE WHEN v_ord <= 5 THEN 0 ELSE 1 END;
      END IF;

      INSERT INTO public.sesion_token_consumos (asamblea_id, session_seq, unidad_id, identificador, tokens_cobrados, consentimiento_id)
      VALUES (v_asamblea.id, v_seq, u, v_id_norm, v_tokens_unit, v_consent_id);
    END LOOP;

    IF NOT v_demo AND v_charge_total > 0 THEN
      v_nuevo_saldo := GREATEST(0, v_saldo - v_charge_total);

      UPDATE public.profiles SET tokens_disponibles = v_nuevo_saldo
      WHERE user_id = v_gestor_user OR id = v_gestor_user;

      INSERT INTO public.billing_logs (user_id, tipo_operacion, asamblea_id, organization_id, tokens_usados, saldo_restante, metadata)
      VALUES (
        v_gestor_user,
        'Consentimiento_sesion',
        v_asamblea.id,
        v_org,
        v_charge_total,
        v_nuevo_saldo,
        jsonb_build_object(
          'session_seq', v_seq,
          'unidad_ids', to_jsonb(v_unidades),
          'tokens_cobrados_en_operacion', v_charge_total,
          'contexto', 'registro_poderes'
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_seq', v_seq,
    'tokens_cobrados', CASE WHEN v_demo THEN 0 ELSE v_charge_total END,
    'unidades', to_jsonb(v_unidades),
    'registro_externo', COALESCE(p_registro_externo, false)
  );
END;
$$;

COMMENT ON FUNCTION public.registrar_consentimiento_registro_poderes(TEXT, TEXT, TEXT, BOOLEAN) IS
  'LOPD /registrar-poder: p_registro_externo=true acepta identificador sin estar en censo (solo código válido).';

GRANT EXECUTE ON FUNCTION public.registrar_consentimiento_registro_poderes(TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
