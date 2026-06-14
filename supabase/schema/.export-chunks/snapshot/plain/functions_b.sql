CREATE OR REPLACE FUNCTION public.marcar_salida_quorum(p_asamblea_id uuid, p_email_votante text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE quorum_asamblea
  SET presente_virtual = false
  WHERE asamblea_id = p_asamblea_id
    AND LOWER(TRIM(email_propietario)) = LOWER(TRIM(p_email_votante));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_presence_stale_offline_lazy(p_asamblea_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH cfg AS (
    SELECT
      c.asamblea_id,
      c.heartbeat_interval_seconds,
      c.idle_after_seconds,
      c.stale_after_seconds,
      c.offline_after_seconds
    FROM quorum_presence_config c
    WHERE c.asamblea_id = p_asamblea_id
  ),
  base AS (
    SELECT
      qp.id,
      presence_status_from_timestamps(
        qp.last_heartbeat_at,
        qp.last_activity_at,
        COALESCE(cfg.heartbeat_interval_seconds, 30),
        COALESCE(cfg.idle_after_seconds, 45),
        COALESCE(cfg.stale_after_seconds, 90),
        COALESCE(cfg.offline_after_seconds, 180)
      ) AS next_status
    FROM quorum_presence qp
    LEFT JOIN cfg ON cfg.asamblea_id = qp.asamblea_id
    WHERE qp.asamblea_id = p_asamblea_id
  )
  UPDATE quorum_presence qp
     SET status = b.next_status,
         disconnected_at = CASE WHEN b.next_status = 'offline' AND qp.disconnected_at IS NULL THEN now() ELSE qp.disconnected_at END
    FROM base b
   WHERE qp.id = b.id
     AND qp.status IS DISTINCT FROM b.next_status;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_telefono(t text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF t IS NULL OR TRIM(t) = '' THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(regexp_replace(TRIM(t), '[^0-9]', '', 'g'), '^57', '');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obtener_votos_votante(p_pregunta_id uuid, p_votante_email text)
 RETURNS TABLE(unidad_id uuid, unidad_numero text, unidad_torre text, opcion_id uuid, texto_opcion text, color_opcion text, es_poder boolean, fecha_voto timestamp with time zone, puede_modificar boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.unidad_id,
    u.numero AS unidad_numero,
    u.torre AS unidad_torre,
    v.opcion_id,
    op.texto_opcion,
    op.color AS color_opcion,
    v.es_poder,
    v.created_at AS fecha_voto,
    (p.estado = 'abierta') AS puede_modificar
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id
  JOIN opciones_pregunta op ON v.opcion_id = op.id
  JOIN preguntas p ON v.pregunta_id = p.id
  WHERE v.pregunta_id = p_pregunta_id
    AND v.votante_email = p_votante_email
  ORDER BY u.torre, u.numero;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.planes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preguntas_punto_misma_asamblea()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.punto_orden_dia_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.puntos_orden_dia pod
    WHERE pod.id = NEW.punto_orden_dia_id AND pod.asamblea_id = NEW.asamblea_id
  ) THEN
    RAISE EXCEPTION 'punto_orden_dia_id debe pertenecer a la misma asamblea';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.presence_status_from_timestamps(p_last_heartbeat_at timestamp with time zone, p_last_activity_at timestamp with time zone, p_heartbeat_interval_seconds integer DEFAULT 30, p_idle_after_seconds integer DEFAULT 45, p_stale_after_seconds integer DEFAULT 90, p_offline_after_seconds integer DEFAULT 180)
 RETURNS quorum_presence_status
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_since_hb DOUBLE PRECISION;
  v_since_activity DOUBLE PRECISION;
BEGIN
  IF p_last_heartbeat_at IS NULL THEN
    RETURN 'offline';
  END IF;

  v_since_hb := EXTRACT(EPOCH FROM (v_now - p_last_heartbeat_at));
  v_since_activity := EXTRACT(EPOCH FROM (v_now - COALESCE(p_last_activity_at, p_last_heartbeat_at)));

  IF v_since_hb >= p_offline_after_seconds THEN
    RETURN 'offline';
  ELSIF v_since_hb >= p_stale_after_seconds THEN
    RETURN 'stale';
  ELSIF v_since_activity >= p_idle_after_seconds THEN
    RETURN 'idle';
  ELSE
    RETURN 'online';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.puede_votar(p_pregunta_id uuid, p_unidad_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ya_voto BOOLEAN;
  v_estado_pregunta TEXT;
BEGIN
  -- Verificar si la pregunta está abierta
  SELECT estado INTO v_estado_pregunta
  FROM preguntas
  WHERE id = p_pregunta_id;
  
  IF v_estado_pregunta != 'abierta' THEN
    RETURN false;
  END IF;
  
  -- Verificar si ya votó
  SELECT EXISTS(
    SELECT 1 FROM votos
    WHERE pregunta_id = p_pregunta_id
      AND unidad_id = p_unidad_id
  ) INTO v_ya_voto;
  
  RETURN NOT v_ya_voto;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_ids_para_verificar_asistencia(p_asamblea_id uuid, p_email text)
 RETURNS TABLE(quorum_id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_participant_key_from_identifier(p_identificador text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT encode(digest(lower(trim(coalesce(p_identificador, ''))), 'sha256'), 'hex');
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_presence_heartbeat_upsert(p_asamblea_id uuid, p_identificador text, p_connection_id uuid DEFAULT NULL::uuid, p_activity_hint boolean DEFAULT false, p_event_type quorum_event_type DEFAULT 'heartbeat'::quorum_event_type, p_pregunta_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(presence_id uuid, participant_key text, status quorum_presence_status, last_heartbeat_at timestamp with time zone, last_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_participant_key TEXT;
  v_presence_id UUID;
  v_prev_status quorum_presence_status;
  v_status quorum_presence_status;
  v_now TIMESTAMPTZ := now();
  v_cfg quorum_presence_config%ROWTYPE;
BEGIN
  IF p_asamblea_id IS NULL OR coalesce(trim(p_identificador), '') = '' THEN
    RAISE EXCEPTION 'Datos de presencia inválidos';
  END IF;

  v_participant_key := quorum_participant_key_from_identifier(p_identificador);

  INSERT INTO quorum_presence_config(asamblea_id)
  VALUES (p_asamblea_id)
  ON CONFLICT (asamblea_id) DO NOTHING;

  SELECT * INTO v_cfg FROM quorum_presence_config WHERE asamblea_id = p_asamblea_id;

  INSERT INTO quorum_presence(
    asamblea_id,
    participant_key,
    auth_user_id,
    connection_id,
    status,
    joined_at,
    last_heartbeat_at,
    last_activity_at,
    reconnected_at
  )
  VALUES (
    p_asamblea_id,
    v_participant_key,
    p_auth_user_id,
    p_connection_id,
    'online',
    v_now,
    v_now,
    CASE WHEN p_activity_hint THEN v_now ELSE v_now END,
    v_now
  )
  ON CONFLICT (asamblea_id, participant_key)
  DO UPDATE SET
    auth_user_id = COALESCE(EXCLUDED.auth_user_id, quorum_presence.auth_user_id),
    connection_id = COALESCE(EXCLUDED.connection_id, quorum_presence.connection_id),
    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    last_activity_at = CASE
      WHEN p_activity_hint OR p_event_type IN ('activity', 'vote_cast', 'reconnected')
        THEN EXCLUDED.last_activity_at
      ELSE quorum_presence.last_activity_at
    END,
    reconnected_at = CASE
      WHEN quorum_presence.status IN ('offline', 'stale')
        THEN EXCLUDED.last_heartbeat_at
      ELSE quorum_presence.reconnected_at
    END,
    disconnected_at = CASE
      WHEN quorum_presence.status = 'offline' THEN NULL
      ELSE quorum_presence.disconnected_at
    END,
    status = 'online'
  RETURNING id INTO v_presence_id;

  SELECT status INTO v_prev_status FROM quorum_presence WHERE id = v_presence_id;

  PERFORM mark_presence_stale_offline_lazy(p_asamblea_id);

  UPDATE quorum_presence qp
     SET status = presence_status_from_timestamps(
       qp.last_heartbeat_at,
       qp.last_activity_at,
       COALESCE(v_cfg.heartbeat_interval_seconds, 30),
       COALESCE(v_cfg.idle_after_seconds, 45),
       COALESCE(v_cfg.stale_after_seconds, 90),
       COALESCE(v_cfg.offline_after_seconds, 180)
     )
   WHERE qp.id = v_presence_id;

  SELECT qp.status, qp.last_heartbeat_at, qp.last_activity_at
    INTO v_status, last_heartbeat_at, last_activity_at
    FROM quorum_presence qp
   WHERE qp.id = v_presence_id;

  INSERT INTO quorum_event_log(
    asamblea_id,
    presence_id,
    participant_key,
    pregunta_id,
    event_type,
    metadata,
    idempotency_key
  )
  VALUES(
    p_asamblea_id,
    v_presence_id,
    v_participant_key,
    p_pregunta_id,
    p_event_type,
    jsonb_build_object(
      'connection_id', p_connection_id,
      'activity_hint', p_activity_hint,
      'previous_status', v_prev_status,
      'new_status', v_status
    ),
    p_idempotency_key
  )
  ON CONFLICT (asamblea_id, idempotency_key) DO NOTHING;

  RETURN QUERY
  SELECT
    v_presence_id,
    v_participant_key,
    v_status,
    last_heartbeat_at,
    last_activity_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_presence_refresh_units(p_asamblea_id uuid, p_identificador text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_participant_key TEXT;
  v_presence_id UUID;
  v_changed INTEGER := 0;
BEGIN
  v_participant_key := quorum_participant_key_from_identifier(p_identificador);

  SELECT id INTO v_presence_id
  FROM quorum_presence
  WHERE asamblea_id = p_asamblea_id
    AND participant_key = v_participant_key
  LIMIT 1;

  IF v_presence_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Rebuild simple para evitar drift de poderes.
  DELETE FROM quorum_presence_units WHERE presence_id = v_presence_id;

  WITH ids AS (
    SELECT q.quorum_id
    FROM quorum_ids_para_verificar_asistencia(p_asamblea_id, p_identificador) q
  ),
  base AS (
    SELECT
      qa.unidad_id,
      u.coeficiente::NUMERIC(12, 6) AS coef,
      EXISTS (
        SELECT 1
        FROM poderes p
        WHERE p.asamblea_id = p_asamblea_id
          AND p.unidad_otorgante_id = qa.unidad_id
          AND p.estado = 'activo'
          AND lower(trim(p.email_receptor)) = lower(trim(p_identificador))
      ) AS es_delegado,
      (
        SELECT p.id
        FROM poderes p
        WHERE p.asamblea_id = p_asamblea_id
          AND p.unidad_otorgante_id = qa.unidad_id
          AND p.estado = 'activo'
          AND lower(trim(p.email_receptor)) = lower(trim(p_identificador))
        LIMIT 1
      ) AS poder_id
    FROM quorum_asamblea qa
    JOIN ids ON ids.quorum_id = qa.id
    JOIN unidades u ON u.id = qa.unidad_id
  )
  INSERT INTO quorum_presence_units(
    presence_id,
    unidad_id,
    poder_id,
    coeficiente_propio,
    coeficiente_delegado
  )
  SELECT
    v_presence_id,
    b.unidad_id,
    b.poder_id,
    CASE WHEN b.es_delegado THEN 0 ELSE b.coef END,
    CASE WHEN b.es_delegado THEN b.coef ELSE 0 END
  FROM base b
  ON CONFLICT (presence_id, unidad_id) DO UPDATE
    SET poder_id = EXCLUDED.poder_id,
        coeficiente_propio = EXCLUDED.coeficiente_propio,
        coeficiente_delegado = EXCLUDED.coeficiente_delegado,
        updated_at = now();

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_consentimiento_registro_poderes(p_codigo text, p_identificador text, p_ip text DEFAULT NULL::text, p_registro_externo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_consentimiento_y_consumo_sesion(p_codigo text, p_identificador text, p_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo TEXT := UPPER(TRIM(p_codigo));
  v_id_norm TEXT := LOWER(TRIM(p_identificador));
  v_asamblea RECORD;
  v_org UUID;
  v_demo BOOLEAN;
  v_mode TEXT;
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

  SELECT a.id, a.organization_id, COALESCE(a.is_demo, false) AS is_demo,
         COALESCE(a.session_mode, 'inactive') AS session_mode,
         COALESCE(a.session_seq, 1) AS session_seq,
         a.acceso_publico
    INTO v_asamblea
  FROM asambleas a
  WHERE a.codigo_acceso = v_codigo
  FOR UPDATE OF a;

  IF v_asamblea.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ASAMBLEA_NOT_FOUND', 'message', 'Código no válido');
  END IF;

  IF NOT v_asamblea.acceso_publico THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCESO_CERRADO', 'message', 'Acceso público desactivado');
  END IF;

  v_org := v_asamblea.organization_id;
  v_demo := v_asamblea.is_demo;
  v_mode := v_asamblea.session_mode;
  v_seq := v_asamblea.session_seq;

  IF v_mode NOT IN ('verification', 'voting') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SESSION_INACTIVE', 'message', 'La sesión no está abierta para aceptar privacidad. Espera a que el administrador inicie verificación o votación.');
  END IF;

  SELECT * INTO v_val FROM validar_votante_asamblea(v_codigo, p_identificador) LIMIT 1;

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

  SELECT o.owner_id INTO v_owner_profile_id FROM organizations o WHERE o.id = v_org;
  IF v_owner_profile_id IS NOT NULL THEN
    SELECT p.user_id INTO v_gestor_user FROM profiles p WHERE p.id = v_owner_profile_id LIMIT 1;
  END IF;
  IF v_gestor_user IS NULL THEN
    SELECT p.user_id INTO v_gestor_user
    FROM profiles p
    WHERE p.organization_id = v_org AND p.user_id IS NOT NULL
    ORDER BY p.created_at NULLS LAST
    LIMIT 1;
  END IF;

  SELECT COUNT(DISTINCT unidad_id)::INT INTO v_n_existentes
  FROM sesion_token_consumos
  WHERE asamblea_id = v_asamblea.id AND session_seq = v_seq;

  v_ord := v_n_existentes;
  v_charge_total := 0;

  FOREACH u IN ARRAY v_unidades LOOP
    IF EXISTS (
      SELECT 1 FROM sesion_token_consumos c
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

    -- Bloqueo de billetera: sin esto, dos consentimientos en paralelo en *distintas* asambleas del mismo gestor
    -- podían leer el mismo saldo y sobrescribir tokens_disponibles (lost update).
    PERFORM 1 FROM profiles p
    WHERE p.user_id = v_gestor_user OR p.id = v_gestor_user
    FOR UPDATE;
    SELECT COALESCE(MAX(p.tokens_disponibles), 0)::INT INTO v_saldo
    FROM profiles p
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

  INSERT INTO consentimiento_tratamiento_datos (asamblea_id, identificador, accepted_at, ip_address, session_seq)
  VALUES (v_asamblea.id, v_id_norm, now(), NULLIF(trim(p_ip), ''), v_seq)
  ON CONFLICT (asamblea_id, identificador, session_seq)
  DO UPDATE SET accepted_at = EXCLUDED.accepted_at, ip_address = COALESCE(EXCLUDED.ip_address, consentimiento_tratamiento_datos.ip_address)
  RETURNING id INTO v_consent_id;

  v_ord := v_n_existentes;

  FOREACH u IN ARRAY v_unidades LOOP
    IF EXISTS (
      SELECT 1 FROM sesion_token_consumos c
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

    INSERT INTO sesion_token_consumos (asamblea_id, session_seq, unidad_id, identificador, tokens_cobrados, consentimiento_id)
    VALUES (v_asamblea.id, v_seq, u, v_id_norm, v_tokens_unit, v_consent_id);
  END LOOP;

  IF NOT v_demo AND v_charge_total > 0 THEN
    v_nuevo_saldo := GREATEST(0, v_saldo - v_charge_total);

    UPDATE profiles SET tokens_disponibles = v_nuevo_saldo
    WHERE user_id = v_gestor_user OR id = v_gestor_user;

    INSERT INTO billing_logs (user_id, tipo_operacion, asamblea_id, organization_id, tokens_usados, saldo_restante, metadata)
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
        'tokens_cobrados_en_operacion', v_charge_total
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_seq', v_seq,
    'tokens_cobrados', CASE WHEN v_demo THEN 0 ELSE v_charge_total END,
    'unidades', to_jsonb(v_unidades)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_voto_con_trazabilidad(p_pregunta_id uuid, p_unidad_id uuid, p_opcion_id uuid, p_votante_email text, p_votante_nombre text, p_es_poder boolean DEFAULT false, p_poder_id uuid DEFAULT NULL::uuid, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(voto_id uuid, accion text, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_voto_existente uuid;
  v_opcion_anterior uuid;
  v_nuevo_voto_id uuid;
  v_accion text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.preguntas
    WHERE id = p_pregunta_id
      AND estado = 'abierta'
  ) THEN
    RAISE EXCEPTION 'La pregunta no está abierta para votación';
  END IF;

  -- Bloqueo para evitar condición de carrera en alta concurrencia
  SELECT id, opcion_id
    INTO v_voto_existente, v_opcion_anterior
  FROM public.votos
  WHERE pregunta_id = p_pregunta_id
    AND unidad_id = p_unidad_id
  FOR UPDATE;

  IF v_voto_existente IS NOT NULL THEN
    v_accion := 'modificar';

    UPDATE public.votos
    SET opcion_id = p_opcion_id,
        votante_email = p_votante_email,
        votante_nombre = p_votante_nombre,
        es_poder = p_es_poder,
        poder_id = p_poder_id
    WHERE id = v_voto_existente;

    v_nuevo_voto_id := v_voto_existente;
  ELSE
    v_accion := 'crear';

    INSERT INTO public.votos (
      pregunta_id, unidad_id, opcion_id, votante_email, votante_nombre, es_poder, poder_id
    )
    VALUES (
      p_pregunta_id, p_unidad_id, p_opcion_id, p_votante_email, p_votante_nombre, p_es_poder, p_poder_id
    )
    RETURNING id INTO v_nuevo_voto_id;
  END IF;

  INSERT INTO public.historial_votos (
    voto_id, pregunta_id, unidad_id, opcion_id, votante_email, votante_nombre,
    es_poder, poder_id, accion, opcion_anterior_id, ip_address, user_agent
  )
  VALUES (
    v_nuevo_voto_id, p_pregunta_id, p_unidad_id, p_opcion_id, p_votante_email, p_votante_nombre,
    p_es_poder, p_poder_id, v_accion, v_opcion_anterior, p_ip_address, p_user_agent
  );

  RETURN QUERY
  SELECT
    v_nuevo_voto_id,
    v_accion,
    CASE
      WHEN v_accion = 'crear' THEN 'Voto registrado exitosamente'
      ELSE 'Voto actualizado exitosamente'
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_voto_publico_seguro(p_codigo text, p_pregunta_id uuid, p_unidad_id uuid, p_opcion_id uuid, p_votante_identificador text, p_votante_nombre text, p_es_poder boolean DEFAULT false, p_poder_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(ok boolean, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_codigo record;
  v_valida record;
  v_email text;
  v_unidades_autorizadas uuid[];
begin
  select * into v_codigo
  from public.validar_codigo_acceso(trim(p_codigo))
  limit 1;

  if v_codigo is null or coalesce(v_codigo.acceso_valido, false) = false then
    return query select false, 'Código de acceso inválido o cerrado';
    return;
  end if;

  v_email := lower(trim(p_votante_identificador));
  select * into v_valida
  from public.validar_votante_asamblea(trim(p_codigo), v_email)
  limit 1;

  if v_valida is null or coalesce(v_valida.puede_votar, false) = false then
    return query select false, 'No autorizado para votar en esta asamblea';
    return;
  end if;

  v_unidades_autorizadas :=
    coalesce(v_valida.unidades_propias, '{}'::uuid[]) ||
    coalesce(v_valida.unidades_poderes, '{}'::uuid[]);

  if not (p_unidad_id = any(v_unidades_autorizadas)) then
    return query select false, 'Unidad no autorizada para este votante';
    return;
  end if;

  perform public.registrar_voto_con_trazabilidad(
    p_pregunta_id,
    p_unidad_id,
    p_opcion_id,
    v_email,
    coalesce(nullif(trim(p_votante_nombre), ''), 'Votante'),
    coalesce(p_es_poder, false),
    p_poder_id,
    p_ip_address,
    p_user_agent
  );

  return query select true, 'Voto registrado';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reporte_auditoria_pregunta(p_pregunta_id uuid)
 RETURNS TABLE(votante_email text, votante_nombre text, unidad_torre text, unidad_numero text, opcion_seleccionada text, es_poder boolean, accion text, opcion_anterior text, fecha_accion timestamp with time zone, ip_address text, user_agent text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    h.votante_email,
    h.votante_nombre,
    u.torre AS unidad_torre,
    u.numero AS unidad_numero,
    op.texto_opcion AS opcion_seleccionada,
    h.es_poder,
    h.accion,
    op_ant.texto_opcion AS opcion_anterior,
    h.created_at AS fecha_accion,
    h.ip_address,
    h.user_agent
  FROM historial_votos h
  JOIN unidades u ON h.unidad_id = u.id
  JOIN opciones_pregunta op ON h.opcion_id = op.id
  LEFT JOIN opciones_pregunta op_ant ON h.opcion_anterior_id = op_ant.id
  WHERE h.pregunta_id = p_pregunta_id
  ORDER BY h.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resumen_poderes_asamblea(p_asamblea_id uuid)
 RETURNS TABLE(total_poderes_activos integer, total_unidades_delegadas integer, coeficiente_total_delegado numeric, porcentaje_coeficiente numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_coeficiente_total_conjunto NUMERIC(12, 6);
BEGIN
  -- Obtener el organization_id de la asamblea
  SELECT a.organization_id INTO v_organization_id
  FROM asambleas a
  WHERE a.id = p_asamblea_id;
  
  -- Calcular el coeficiente total del conjunto
  SELECT COALESCE(SUM(coeficiente), 0) INTO v_coeficiente_total_conjunto
  FROM unidades
  WHERE organization_id = v_organization_id;
  
  -- Calcular resumen de poderes
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_poderes_activos,
    COUNT(DISTINCT p.unidad_otorgante_id)::INTEGER AS total_unidades_delegadas,
    COALESCE(SUM(u.coeficiente), 0) AS coeficiente_total_delegado,
    CASE 
      WHEN v_coeficiente_total_conjunto > 0 THEN
        ROUND((COALESCE(SUM(u.coeficiente), 0) / v_coeficiente_total_conjunto * 100)::NUMERIC, 2)
      ELSE 0
    END AS porcentaje_coeficiente
  FROM poderes p
  JOIN unidades u ON p.unidad_otorgante_id = u.id
  WHERE p.asamblea_id = p_asamblea_id
    AND p.estado = 'activo';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_tokens_bienvenida()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.tokens_disponibles IS NULL OR NEW.tokens_disponibles < 0 THEN
    NEW.tokens_disponibles := 50;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_verificacion_asistencia_sesion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_verificados      INT;
  v_coeficiente_verificado NUMERIC(12, 6);
  v_porcentaje_verificado  NUMERIC(6, 2);
  v_quorum_alcanzado       BOOLEAN;
  rec                      RECORD;
BEGIN
  IF OLD.verificacion_asistencia_activa IS NOT DISTINCT FROM NEW.verificacion_asistencia_activa THEN
    RETURN NEW;
  END IF;

  IF NEW.verificacion_asistencia_activa = true THEN
    INSERT INTO verificacion_asamblea_sesiones (asamblea_id, apertura_at)
    VALUES (NEW.id, now());
    RETURN NEW;
  END IF;

  -- Desactivación: snapshot del contexto que se cierra (OLD.verificacion_pregunta_id)
  FOR rec IN
    SELECT * FROM calcular_verificacion_quorum(NEW.id, OLD.verificacion_pregunta_id) LIMIT 1
  LOOP
    v_total_verificados      := rec.total_verificados;
    v_coeficiente_verificado := rec.coeficiente_verificado;
    v_porcentaje_verificado  := rec.porcentaje_verificado;
    v_quorum_alcanzado       := rec.quorum_alcanzado;
    EXIT;
  END LOOP;

  UPDATE verificacion_asamblea_sesiones
  SET
    cierre_at              = now(),
    total_verificados      = COALESCE(v_total_verificados, 0),
    coeficiente_verificado = COALESCE(v_coeficiente_verificado, 0),
    porcentaje_verificado  = COALESCE(v_porcentaje_verificado, 0),
    quorum_alcanzado       = COALESCE(v_quorum_alcanzado, false)
  WHERE asamblea_id = NEW.id
    AND cierre_at IS NULL;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unidad_email_coincide(campo_email text, identificador text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(COALESCE(TRIM(campo_email), ''), E'[,;\\s]+') AS t(token)
    WHERE LOWER(TRIM(t.token)) = LOWER(TRIM(identificador))
      AND LENGTH(TRIM(t.token)) > 0
  );
$function$
;

CREATE OR REPLACE FUNCTION public.unidad_ids_verificados_sesion_actual(p_asamblea_id uuid, p_pregunta_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(unidad_id uuid, es_poder boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ultima_cerrada AS (
    SELECT s.apertura_at AS apertura_ult_cerrada, s.cierre_at AS cierre_ult
      FROM verificacion_asamblea_sesiones s
     WHERE s.asamblea_id = p_asamblea_id
       AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
       AND s.cierre_at IS NOT NULL
     ORDER BY s.cierre_at DESC
     LIMIT 1
  ),
  ventana AS (
    SELECT
      (SELECT s.apertura_at
         FROM verificacion_asamblea_sesiones s
        WHERE s.asamblea_id = p_asamblea_id
          AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
          AND s.cierre_at IS NULL
        ORDER BY s.apertura_at DESC
        LIMIT 1) AS apertura_abierta,
      (SELECT u.apertura_ult_cerrada FROM ultima_cerrada u) AS apertura_ult_cerrada,
      (SELECT u.cierre_ult FROM ultima_cerrada u) AS cierre_ult
  )
  SELECT DISTINCT ON (qa.unidad_id)
    qa.unidad_id,
    CASE
      WHEN unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), qa.email_propietario) THEN false
      WHEN EXISTS (
        SELECT 1 FROM poderes p
        WHERE p.unidad_otorgante_id = qa.unidad_id
          AND p.asamblea_id = p_asamblea_id
          AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(qa.email_propietario))
          AND p.estado = 'activo'
      ) THEN true
      ELSE false
    END AS es_poder
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  CROSS JOIN ventana w
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND (
      (w.apertura_abierta IS NOT NULL AND r.creado_en >= w.apertura_abierta)
      OR (
        w.apertura_abierta IS NULL
        AND w.apertura_ult_cerrada IS NOT NULL
        AND w.cierre_ult IS NOT NULL
        AND r.creado_en >= w.apertura_ult_cerrada
        AND r.creado_en <= w.cierre_ult
      )
    )
  ORDER BY qa.unidad_id;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_codigo_acceso(p_codigo text)
 RETURNS TABLE(asamblea_id uuid, nombre text, fecha date, organization_id uuid, nombre_conjunto text, acceso_valido boolean, mensaje text, participacion_timer_end_at timestamp with time zone, participacion_timer_default_minutes integer, participacion_timer_enabled boolean, session_mode text, session_seq integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asamblea RECORD;
BEGIN
  SELECT
    a.id,
    a.nombre,
    a.fecha::DATE,
    a.organization_id,
    a.acceso_publico,
    COALESCE(o.name, 'Sin nombre') AS nombre_conjunto,
    a.participacion_timer_end_at,
    a.participacion_timer_default_minutes,
    a.participacion_timer_enabled,
    COALESCE(a.session_mode, 'inactive') AS session_mode,
    COALESCE(a.session_seq, 1) AS session_seq
  INTO v_asamblea
  FROM asambleas a
  LEFT JOIN organizations o ON a.organization_id = o.id
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo));

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      NULL::UUID, NULL::TEXT, NULL::DATE, NULL::UUID, NULL::TEXT,
      false, 'Código de acceso inválido o no existe'::TEXT,
      NULL::TIMESTAMPTZ, 5, true, 'inactive'::TEXT, 1;
    RETURN;
  END IF;

  IF NOT v_asamblea.acceso_publico THEN
    RETURN QUERY
    SELECT
      v_asamblea.id, v_asamblea.nombre, v_asamblea.fecha, v_asamblea.organization_id,
      v_asamblea.nombre_conjunto, false,
      'El acceso público a esta asamblea está desactivado'::TEXT,
      v_asamblea.participacion_timer_end_at,
      COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
      COALESCE(v_asamblea.participacion_timer_enabled, true),
      v_asamblea.session_mode, v_asamblea.session_seq;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_asamblea.id, v_asamblea.nombre, v_asamblea.fecha, v_asamblea.organization_id,
    v_asamblea.nombre_conjunto, true, 'Código válido. Acceso permitido.'::TEXT,
    v_asamblea.participacion_timer_end_at,
    COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
    COALESCE(v_asamblea.participacion_timer_enabled, true),
    v_asamblea.session_mode, v_asamblea.session_seq;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_codigo_registro_poderes(p_codigo text)
 RETURNS TABLE(asamblea_id uuid, nombre text, fecha date, organization_id uuid, nombre_conjunto text, acceso_valido boolean, mensaje text, participacion_timer_end_at timestamp with time zone, participacion_timer_default_minutes integer, participacion_timer_enabled boolean, session_mode text, session_seq integer, registro_poderes_publico boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validar_limite_poderes(p_asamblea_id uuid, p_email_receptor text, p_organization_id uuid)
 RETURNS TABLE(puede_recibir_poder boolean, poderes_actuales integer, limite_maximo integer, mensaje text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_poderes_actuales INTEGER;
  v_limite_maximo INTEGER;
BEGIN
  -- Obtener límite configurado para este conjunto
  SELECT max_poderes_por_apoderado INTO v_limite_maximo
  FROM configuracion_poderes
  WHERE organization_id = p_organization_id;
  
  -- Si no hay configuración, usar límite por defecto de 3
  IF v_limite_maximo IS NULL THEN
    v_limite_maximo := 3;
  END IF;
  
  -- Contar poderes activos que ya tiene este receptor en esta asamblea
  SELECT COUNT(*) INTO v_poderes_actuales
  FROM poderes
  WHERE asamblea_id = p_asamblea_id
    AND email_receptor = p_email_receptor
    AND estado = 'activo';
  
  -- Determinar si puede recibir más poderes
  RETURN QUERY
  SELECT 
    (v_poderes_actuales < v_limite_maximo) AS puede_recibir_poder,
    v_poderes_actuales AS poderes_actuales,
    v_limite_maximo AS limite_maximo,
    CASE 
      WHEN v_poderes_actuales < v_limite_maximo THEN 'Puede recibir más poderes'
      ELSE 'Ha alcanzado el límite máximo de poderes (' || v_limite_maximo || ')'
    END AS mensaje;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_votante_asamblea(p_codigo_asamblea text, p_email_votante text)
 RETURNS TABLE(puede_votar boolean, unidades_propias uuid[], unidades_poderes uuid[], total_unidades integer, total_coeficiente numeric, mensaje text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asamblea_id UUID;
  v_organization_id UUID;
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_total_coef NUMERIC;
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
$function$
;

CREATE OR REPLACE FUNCTION public.validar_votante_registro_poderes(p_codigo_asamblea text, p_email_votante text)
 RETURNS TABLE(puede_votar boolean, unidades_propias uuid[], unidades_poderes uuid[], total_unidades integer, total_coeficiente numeric, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.ya_verifico_asistencia(p_asamblea_id uuid, p_email text, p_pregunta_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM verificacion_asistencia_registro r
      JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
     WHERE r.asamblea_id = p_asamblea_id
       AND LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
       AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
  );
END;
$function$
;
