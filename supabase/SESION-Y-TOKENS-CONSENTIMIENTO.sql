-- =====================================================
-- Sesión global (modo + secuencia) + consumo de tokens al aceptar LOPD
-- Umbral: las primeras 5 unidades distintas en la sesión no generan cobro;
--         a partir de la 6.ª unidad nueva, 1 token por unidad (sin retroactividad).
-- Ejecutar en Supabase SQL Editor (una vez), después de dependencias existentes.
-- =====================================================

-- 1) Columnas en asambleas
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'inactive'
    CHECK (session_mode IN ('inactive', 'verification', 'voting'));

ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS session_seq INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN asambleas.session_mode IS 'inactive | verification | voting — controla qué ve el votante en /votar';
COMMENT ON COLUMN asambleas.session_seq IS 'Se incrementa al cerrar sesión o desactivar votación pública; consentimientos y consumos van por secuencia';

-- 2) Consentimiento por sesión (reapertura = nuevo session_seq)
ALTER TABLE consentimiento_tratamiento_datos
  ADD COLUMN IF NOT EXISTS session_seq INTEGER NOT NULL DEFAULT 1;

ALTER TABLE consentimiento_tratamiento_datos
  DROP CONSTRAINT IF EXISTS consentimiento_tratamiento_datos_asamblea_id_identificador_key;

-- Reejecutable: quitar el único por sesión si ya existía
ALTER TABLE consentimiento_tratamiento_datos
  DROP CONSTRAINT IF EXISTS consentimiento_tratamiento_datos_asamblea_ident_session_uq;

ALTER TABLE consentimiento_tratamiento_datos
  ADD CONSTRAINT consentimiento_tratamiento_datos_asamblea_ident_session_uq
  UNIQUE (asamblea_id, identificador, session_seq);

-- 3) Consumos idempotentes por unidad y sesión
CREATE TABLE IF NOT EXISTS sesion_token_consumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  session_seq INTEGER NOT NULL,
  unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  identificador TEXT NOT NULL,
  tokens_cobrados INTEGER NOT NULL DEFAULT 0 CHECK (tokens_cobrados >= 0),
  consentimiento_id UUID REFERENCES consentimiento_tratamiento_datos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asamblea_id, session_seq, unidad_id)
);

CREATE INDEX IF NOT EXISTS idx_sesion_token_consumos_asamblea_seq
  ON sesion_token_consumos(asamblea_id, session_seq);

COMMENT ON TABLE sesion_token_consumos IS 'Cobro LOPD por unidad y sesión; evita doble cobro multi-dispositivo (UNIQUE asamblea+seq+unidad)';

ALTER TABLE sesion_token_consumos ENABLE ROW LEVEL SECURITY;

-- 4) billing_logs: tipo Consentimiento_sesion
ALTER TABLE billing_logs DROP CONSTRAINT IF EXISTS billing_logs_tipo_operacion_check;
ALTER TABLE billing_logs ADD CONSTRAINT billing_logs_tipo_operacion_check
  CHECK (tipo_operacion IN (
    'Acta', 'Votación', 'Registro_manual', 'Compra', 'Ajuste_manual', 'WhatsApp', 'Consentimiento_sesion'
  ));

-- 5) validar_codigo_acceso: exponer session_mode y session_seq
DROP FUNCTION IF EXISTS validar_codigo_acceso(TEXT);

CREATE OR REPLACE FUNCTION validar_codigo_acceso(p_codigo TEXT)
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
  session_seq INTEGER
) AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_codigo_acceso(TEXT) IS 'Valida código de acceso; incluye session_mode y session_seq para LOPD/sesión';

-- 6) Activar / desactivar votación pública + sesión
CREATE OR REPLACE FUNCTION activar_votacion_publica(
  p_asamblea_id UUID,
  p_base_url TEXT DEFAULT 'https://tu-dominio.com'
)
RETURNS TABLE (
  codigo TEXT,
  url TEXT,
  mensaje TEXT
) AS $$
DECLARE
  v_codigo TEXT;
  v_url TEXT;
  v_intentos INT := 0;
  v_max_intentos INT := 10;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM asambleas WHERE id = p_asamblea_id) THEN
    RAISE EXCEPTION 'La asamblea no existe';
  END IF;

  SELECT codigo_acceso INTO v_codigo FROM asambleas WHERE id = p_asamblea_id;

  IF v_codigo IS NULL THEN
    LOOP
      v_codigo := generar_codigo_acceso();
      v_intentos := v_intentos + 1;
      IF NOT EXISTS (SELECT 1 FROM asambleas WHERE codigo_acceso = v_codigo) THEN
        EXIT;
      END IF;
      IF v_intentos >= v_max_intentos THEN
        RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', v_max_intentos;
      END IF;
    END LOOP;
  END IF;

  v_url := p_base_url || '/votar/' || v_codigo;

  UPDATE asambleas
  SET
    codigo_acceso = v_codigo,
    url_publica = v_url,
    acceso_publico = true,
    session_mode = 'voting'
  WHERE id = p_asamblea_id;

  RETURN QUERY
  SELECT v_codigo, v_url, 'Votación pública activada exitosamente'::TEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION desactivar_votacion_publica(p_asamblea_id UUID)
RETURNS TEXT AS $$
BEGIN
  UPDATE asambleas
  SET
    acceso_publico = false,
    session_mode = 'inactive',
    session_seq = COALESCE(session_seq, 1) + 1
  WHERE id = p_asamblea_id;

  RETURN 'Acceso público desactivado. Nueva sesión al reactivar (consentimientos previos por secuencia quedan en historial).';
END;
$$ LANGUAGE plpgsql;

-- 7) RPC atómica: consentimiento + consumos + débito (saldo comprobado antes de insertar consumos)
DROP FUNCTION IF EXISTS registrar_consentimiento_y_consumo_sesion(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION registrar_consentimiento_y_consumo_sesion(
  p_codigo TEXT,
  p_identificador TEXT,
  p_ip TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION registrar_consentimiento_y_consumo_sesion IS 'LOPD + consumo umbral 5 unidades; idempotente por unidad/sesión (UNIQUE + mismo identificador); FOR UPDATE asamblea serializa por código; FOR UPDATE profiles evita lost update entre asambleas; SECURITY DEFINER';

-- 8) Cerrar sesión (sin desactivar enlace público): nueva ronda de consentimientos / contadores.
-- Nota: el panel solo usa «Desactivar votación» (desactivar_votacion_publica). Esta RPC queda para scripts o integraciones que necesiten nuevo session_seq sin cerrar acceso_publico.
CREATE OR REPLACE FUNCTION cerrar_sesion_votacion_publica(p_asamblea_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE asambleas
  SET
    session_mode = 'inactive',
    session_seq = COALESCE(session_seq, 1) + 1
  WHERE id = p_asamblea_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION cerrar_sesion_votacion_publica IS 'Incrementa session_seq y pone modo inactive; los votantes deberán aceptar LOPD de nuevo en la nueva sesión';
