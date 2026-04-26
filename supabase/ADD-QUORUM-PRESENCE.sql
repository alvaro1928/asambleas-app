-- ============================================================
-- Quorum automático por presencia (heartbeat + actividad + voto)
-- ============================================================
-- Objetivo:
-- 1) Separar autenticación (cookie/sesión) de presencia para quórum.
-- 2) Calcular quórum activo por coeficiente sin duplicar multi-pestaña.
-- 3) Persistir eventos y snapshots históricos para acta auditable.
-- 4) Mantener compatibilidad con tablas/verificación histórica actuales.
-- ============================================================

-- ---------- extensiones útiles ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- catálogos ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quorum_presence_status') THEN
    CREATE TYPE quorum_presence_status AS ENUM ('online', 'idle', 'stale', 'offline');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quorum_event_type') THEN
    CREATE TYPE quorum_event_type AS ENUM (
      'joined',
      'heartbeat',
      'activity',
      'vote_cast',
      'stale',
      'offline',
      'reconnected',
      'quorum_recalculated',
      'quorum_lost',
      'quorum_recovered',
      'admin_override',
      'snapshot_created'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quorum_snapshot_type') THEN
    CREATE TYPE quorum_snapshot_type AS ENUM (
      'assembly_opening',
      'voting_opening',
      'voting_closing',
      'quorum_change',
      'assembly_closing',
      'manual_check'
    );
  END IF;
END$$;

-- ---------- configuración por asamblea ----------
CREATE TABLE IF NOT EXISTS quorum_presence_config (
  asamblea_id UUID PRIMARY KEY REFERENCES asambleas(id) ON DELETE CASCADE,
  heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 30 CHECK (heartbeat_interval_seconds BETWEEN 5 AND 120),
  idle_after_seconds INTEGER NOT NULL DEFAULT 45 CHECK (idle_after_seconds BETWEEN 15 AND 900),
  stale_after_seconds INTEGER NOT NULL DEFAULT 90 CHECK (stale_after_seconds BETWEEN 30 AND 1800),
  offline_after_seconds INTEGER NOT NULL DEFAULT 180 CHECK (offline_after_seconds BETWEEN 60 AND 3600),
  quorum_rules JSONB NOT NULL DEFAULT '{"type":"deliberative","thresholdPercent":50,"convocatoria":1}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quorum_presence_config_updated_at
  ON quorum_presence_config(updated_at DESC);

-- ---------- presencia agregada por participante ----------
CREATE TABLE IF NOT EXISTS quorum_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  auth_user_id UUID NULL,
  connection_id UUID NULL,
  status quorum_presence_status NOT NULL DEFAULT 'online',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ NULL,
  reconnected_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asamblea_id, participant_key)
);

CREATE INDEX IF NOT EXISTS idx_quorum_presence_asamblea_status
  ON quorum_presence(asamblea_id, status);
CREATE INDEX IF NOT EXISTS idx_quorum_presence_asamblea_heartbeat
  ON quorum_presence(asamblea_id, last_heartbeat_at DESC);

-- ---------- unidades representadas por participante ----------
CREATE TABLE IF NOT EXISTS quorum_presence_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presence_id UUID NOT NULL REFERENCES quorum_presence(id) ON DELETE CASCADE,
  unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  poder_id UUID NULL REFERENCES poderes(id) ON DELETE SET NULL,
  coeficiente_propio NUMERIC(12, 6) NOT NULL DEFAULT 0,
  coeficiente_delegado NUMERIC(12, 6) NOT NULL DEFAULT 0,
  total_represented_coefficient NUMERIC(12, 6) GENERATED ALWAYS AS (coeficiente_propio + coeficiente_delegado) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (presence_id, unidad_id)
);

CREATE INDEX IF NOT EXISTS idx_quorum_presence_units_presence
  ON quorum_presence_units(presence_id);
CREATE INDEX IF NOT EXISTS idx_quorum_presence_units_unidad
  ON quorum_presence_units(unidad_id);

-- ---------- log auditable de eventos ----------
CREATE TABLE IF NOT EXISTS quorum_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  presence_id UUID NULL REFERENCES quorum_presence(id) ON DELETE SET NULL,
  participant_key TEXT NULL,
  pregunta_id UUID NULL REFERENCES preguntas(id) ON DELETE SET NULL,
  event_type quorum_event_type NOT NULL,
  coefficient_impacted NUMERIC(12, 6) NULL,
  total_quorum_after NUMERIC(12, 6) NULL,
  quorum_percentage_after NUMERIC(6, 2) NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asamblea_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_quorum_event_log_asamblea_created
  ON quorum_event_log(asamblea_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quorum_event_log_type_created
  ON quorum_event_log(event_type, created_at DESC);

-- ---------- snapshots para acta ----------
CREATE TABLE IF NOT EXISTS quorum_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  pregunta_id UUID NULL REFERENCES preguntas(id) ON DELETE SET NULL,
  snapshot_type quorum_snapshot_type NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_participants_count INTEGER NOT NULL DEFAULT 0,
  delegated_participants_count INTEGER NOT NULL DEFAULT 0,
  active_coefficient_total NUMERIC(12, 6) NOT NULL DEFAULT 0,
  delegated_coefficient_total NUMERIC(12, 6) NOT NULL DEFAULT 0,
  total_represented_coefficient NUMERIC(12, 6) NOT NULL DEFAULT 0,
  total_assembly_coefficient NUMERIC(12, 6) NOT NULL DEFAULT 0,
  quorum_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0,
  quorum_rule_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
  quorum_met BOOLEAN NOT NULL DEFAULT false,
  generated_by_event_id UUID NULL REFERENCES quorum_event_log(id) ON DELETE SET NULL,
  generated_by_user UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_quorum_snapshot_asamblea_taken
  ON quorum_snapshot(asamblea_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_quorum_snapshot_asamblea_pregunta
  ON quorum_snapshot(asamblea_id, pregunta_id, taken_at DESC);

-- ---------- utilidades ----------
CREATE OR REPLACE FUNCTION quorum_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quorum_presence_touch ON quorum_presence;
CREATE TRIGGER trg_quorum_presence_touch
BEFORE UPDATE ON quorum_presence
FOR EACH ROW
EXECUTE FUNCTION quorum_touch_updated_at();

DROP TRIGGER IF EXISTS trg_quorum_presence_units_touch ON quorum_presence_units;
CREATE TRIGGER trg_quorum_presence_units_touch
BEFORE UPDATE ON quorum_presence_units
FOR EACH ROW
EXECUTE FUNCTION quorum_touch_updated_at();

DROP TRIGGER IF EXISTS trg_quorum_presence_config_touch ON quorum_presence_config;
CREATE TRIGGER trg_quorum_presence_config_touch
BEFORE UPDATE ON quorum_presence_config
FOR EACH ROW
EXECUTE FUNCTION quorum_touch_updated_at();

-- Clave estable por participante (email/doc/teléfono normalizado)
CREATE OR REPLACE FUNCTION quorum_participant_key_from_identifier(p_identificador TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest(lower(trim(coalesce(p_identificador, ''))), 'sha256'), 'hex');
$$;

COMMENT ON FUNCTION quorum_participant_key_from_identifier(TEXT) IS
  'Genera participant_key estable (sha256) a partir de identificador normalizado.';

-- Estado derivado centralizado
CREATE OR REPLACE FUNCTION presence_status_from_timestamps(
  p_last_heartbeat_at TIMESTAMPTZ,
  p_last_activity_at TIMESTAMPTZ,
  p_heartbeat_interval_seconds INTEGER DEFAULT 30,
  p_idle_after_seconds INTEGER DEFAULT 45,
  p_stale_after_seconds INTEGER DEFAULT 90,
  p_offline_after_seconds INTEGER DEFAULT 180
)
RETURNS quorum_presence_status
LANGUAGE plpgsql
STABLE
AS $$
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
$$;

-- Marca stale/offline de forma lazy (útil en serverless sin cron)
CREATE OR REPLACE FUNCTION mark_presence_stale_offline_lazy(p_asamblea_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Upsert de presencia por heartbeat/actividad/voto
CREATE OR REPLACE FUNCTION quorum_presence_heartbeat_upsert(
  p_asamblea_id UUID,
  p_identificador TEXT,
  p_connection_id UUID DEFAULT NULL,
  p_activity_hint BOOLEAN DEFAULT false,
  p_event_type quorum_event_type DEFAULT 'heartbeat',
  p_pregunta_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  presence_id UUID,
  participant_key TEXT,
  status quorum_presence_status,
  last_heartbeat_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Asigna unidades representadas al participante de presencia
CREATE OR REPLACE FUNCTION quorum_presence_refresh_units(
  p_asamblea_id UUID,
  p_identificador TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Cálculo oficial de quórum por presencia (coeficiente)
CREATE OR REPLACE FUNCTION calcular_quorum_presencia(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_unidades INTEGER,
  total_participantes INTEGER,
  participantes_activos INTEGER,
  participantes_delegados_activos INTEGER,
  active_coefficient_total NUMERIC(12, 6),
  delegated_coefficient_total NUMERIC(12, 6),
  total_represented_coefficient NUMERIC(12, 6),
  total_assembly_coefficient NUMERIC(12, 6),
  quorum_percentage NUMERIC(6, 2),
  quorum_met BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_org_id UUID;
  v_is_demo BOOLEAN;
  v_total_coef NUMERIC(12, 6);
  v_rules JSONB;
  v_threshold NUMERIC(6, 2);
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_org_id, v_is_demo
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT quorum_rules INTO v_rules
  FROM quorum_presence_config
  WHERE asamblea_id = p_asamblea_id;

  IF v_rules IS NULL THEN
    v_rules := '{"thresholdPercent":50}'::jsonb;
  END IF;

  v_threshold := COALESCE(NULLIF((v_rules->>'thresholdPercent')::NUMERIC, NULL), 50);

  SELECT COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)
    INTO v_total_coef
  FROM unidades u
  WHERE u.organization_id = v_org_id
    AND COALESCE(u.is_demo, false) = v_is_demo;

  RETURN QUERY
  WITH pu AS (
    SELECT
      qp.id AS presence_id,
      qp.status,
      qp.participant_key,
      SUM(qpu.coeficiente_propio)::NUMERIC(12, 6) AS coef_propio,
      SUM(qpu.coeficiente_delegado)::NUMERIC(12, 6) AS coef_delegado,
      SUM(qpu.total_represented_coefficient)::NUMERIC(12, 6) AS coef_total
    FROM quorum_presence qp
    LEFT JOIN quorum_presence_units qpu ON qpu.presence_id = qp.id
    WHERE qp.asamblea_id = p_asamblea_id
    GROUP BY qp.id, qp.status, qp.participant_key
  ),
  active AS (
    SELECT *
    FROM pu
    WHERE status IN ('online', 'idle')
  ),
  s AS (
    SELECT
      (SELECT COUNT(*)::INTEGER FROM unidades u WHERE u.organization_id = v_org_id AND COALESCE(u.is_demo, false) = v_is_demo) AS total_unidades,
      (SELECT COUNT(*)::INTEGER FROM pu) AS total_participantes,
      (SELECT COUNT(*)::INTEGER FROM active) AS participantes_activos,
      (SELECT COUNT(*)::INTEGER FROM active WHERE coef_delegado > 0) AS participantes_delegados_activos,
      COALESCE((SELECT SUM(coef_propio) FROM active), 0)::NUMERIC(12, 6) AS active_coef,
      COALESCE((SELECT SUM(coef_delegado) FROM active), 0)::NUMERIC(12, 6) AS delegated_coef
  )
  SELECT
    s.total_unidades,
    s.total_participantes,
    s.participantes_activos,
    s.participantes_delegados_activos,
    s.active_coef AS active_coefficient_total,
    s.delegated_coef AS delegated_coefficient_total,
    (s.active_coef + s.delegated_coef)::NUMERIC(12, 6) AS total_represented_coefficient,
    v_total_coef AS total_assembly_coefficient,
    CASE
      WHEN v_total_coef > 0 THEN ROUND(((s.active_coef + s.delegated_coef) / v_total_coef) * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2) AS quorum_percentage,
    CASE
      WHEN v_total_coef > 0 THEN (((s.active_coef + s.delegated_coef) / v_total_coef) * 100) >= v_threshold
      ELSE false
    END AS quorum_met
  FROM s;
END;
$$;

-- Inserta snapshot histórico reutilizable por acta
CREATE OR REPLACE FUNCTION insert_quorum_snapshot(
  p_asamblea_id UUID,
  p_snapshot_type quorum_snapshot_type,
  p_pregunta_id UUID DEFAULT NULL,
  p_generated_by_event_id UUID DEFAULT NULL,
  p_generated_by_user UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_calc RECORD;
  v_rules JSONB;
BEGIN
  SELECT * INTO v_calc
  FROM calcular_quorum_presencia(p_asamblea_id, p_pregunta_id)
  LIMIT 1;

  SELECT quorum_rules INTO v_rules
  FROM quorum_presence_config
  WHERE asamblea_id = p_asamblea_id;

  IF v_rules IS NULL THEN
    v_rules := '{"thresholdPercent":50}'::jsonb;
  END IF;

  INSERT INTO quorum_snapshot(
    asamblea_id,
    pregunta_id,
    snapshot_type,
    active_participants_count,
    delegated_participants_count,
    active_coefficient_total,
    delegated_coefficient_total,
    total_represented_coefficient,
    total_assembly_coefficient,
    quorum_percentage,
    quorum_rule_applied,
    quorum_met,
    generated_by_event_id,
    generated_by_user,
    metadata
  )
  VALUES (
    p_asamblea_id,
    p_pregunta_id,
    p_snapshot_type,
    COALESCE(v_calc.participantes_activos, 0),
    COALESCE(v_calc.participantes_delegados_activos, 0),
    COALESCE(v_calc.active_coefficient_total, 0),
    COALESCE(v_calc.delegated_coefficient_total, 0),
    COALESCE(v_calc.total_represented_coefficient, 0),
    COALESCE(v_calc.total_assembly_coefficient, 0),
    COALESCE(v_calc.quorum_percentage, 0),
    v_rules,
    COALESCE(v_calc.quorum_met, false),
    p_generated_by_event_id,
    p_generated_by_user,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  INSERT INTO quorum_event_log(
    asamblea_id,
    pregunta_id,
    event_type,
    coefficient_impacted,
    total_quorum_after,
    quorum_percentage_after,
    metadata
  )
  VALUES(
    p_asamblea_id,
    p_pregunta_id,
    'snapshot_created',
    COALESCE(v_calc.total_represented_coefficient, 0),
    COALESCE(v_calc.total_represented_coefficient, 0),
    COALESCE(v_calc.quorum_percentage, 0),
    jsonb_build_object(
      'snapshot_id', v_id,
      'snapshot_type', p_snapshot_type
    )
  );

  RETURN v_id;
END;
$$;

-- ---------- grants ----------
GRANT EXECUTE ON FUNCTION presence_status_from_timestamps(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_quorum_presencia(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_presence_stale_offline_lazy(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION quorum_presence_heartbeat_upsert(UUID, TEXT, UUID, BOOLEAN, quorum_event_type, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION quorum_presence_refresh_units(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_quorum_snapshot(UUID, quorum_snapshot_type, UUID, UUID, UUID, JSONB) TO authenticated;
