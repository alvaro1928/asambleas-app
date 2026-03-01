-- ============================================================
-- Verificación de asistencia por pregunta (o general)
--
-- - Sin preguntas abiertas: la verificación es "general" (pregunta_id null).
-- - Con pregunta abierta: la verificación queda asociada solo a esa pregunta.
-- - Quien no verifica en una ronda mantiene la verificación anterior
--   (general o de una pregunta ya cerrada).
-- ============================================================

-- 1. Contexto de verificación en asamblea (qué pregunta está asociada a la ronda actual)
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS verificacion_pregunta_id UUID REFERENCES preguntas(id) ON DELETE SET NULL;

COMMENT ON COLUMN asambleas.verificacion_pregunta_id IS
  'Cuando verificacion_asistencia_activa es true: null = verificación general (sin preguntas abiertas); si hay pregunta abierta, el id de esa pregunta. Las verificaciones se registran en verificacion_asistencia_registro con este contexto.';

-- 2. Tabla de registros de verificación por contexto (general o por pregunta)
CREATE TABLE IF NOT EXISTS verificacion_asistencia_registro (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id       UUID NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  quorum_asamblea_id UUID NOT NULL REFERENCES quorum_asamblea(id) ON DELETE CASCADE,
  pregunta_id       UUID REFERENCES preguntas(id) ON DELETE CASCADE,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un solo registro por (unidad en asamblea, contexto); NULL = general (Postgres 15+)
CREATE UNIQUE INDEX IF NOT EXISTS idx_verif_registro_quorum_pregunta
  ON verificacion_asistencia_registro(quorum_asamblea_id, pregunta_id) NULLS NOT DISTINCT;

COMMENT ON TABLE verificacion_asistencia_registro IS
  'Una fila por (unidad en asamblea, contexto). pregunta_id null = verificación general; no null = verificación asociada a esa pregunta.';

CREATE INDEX IF NOT EXISTS idx_verif_registro_asamblea_pregunta
  ON verificacion_asistencia_registro(asamblea_id, pregunta_id);

-- 3. Migrar datos existentes: quorum_asamblea.verifico_asistencia = true → registro general
INSERT INTO verificacion_asistencia_registro (asamblea_id, quorum_asamblea_id, pregunta_id, creado_en)
SELECT qa.asamblea_id, qa.id, NULL, COALESCE(qa.hora_verificacion, now())
  FROM quorum_asamblea qa
 WHERE qa.verifico_asistencia = true
   AND NOT EXISTS (
     SELECT 1 FROM verificacion_asistencia_registro r
     WHERE r.quorum_asamblea_id = qa.id AND r.pregunta_id IS NULL
   )
ON CONFLICT (quorum_asamblea_id, pregunta_id) DO NOTHING;

-- 4. Función: calcular verificación para un contexto (general o una pregunta)
CREATE OR REPLACE FUNCTION calcular_verificacion_quorum(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_verificados      INT,
  coeficiente_verificado NUMERIC(12, 6),
  porcentaje_verificado  NUMERIC(6, 2),
  quorum_alcanzado       BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
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

  -- Contar desde verificacion_asistencia_registro para el contexto (pregunta o general)
  RETURN QUERY
  SELECT
    COUNT(DISTINCT r.quorum_asamblea_id)::INT                              AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)                       AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                                   AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                                   AS quorum_alcanzado
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id);
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum(UUID, UUID) IS
  'Calcula verificación de asistencia para un contexto: p_pregunta_id null = general; no null = esa pregunta. Ley 675 Art. 45.';

-- 4b. RPC para saber si un votante ya verificó en el contexto actual (general o pregunta)
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
     WHERE r.asamblea_id = p_asamblea_id
       AND LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
       AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
  );
END;
$$;

COMMENT ON FUNCTION ya_verifico_asistencia(UUID, TEXT, UUID) IS
  'True si el votante (email) tiene al menos un registro de verificación en el contexto (pregunta o general).';

-- 5. Actualizar trigger de sesiones para usar el contexto al desactivar (snapshot del contexto que se cierra)
CREATE OR REPLACE FUNCTION trg_verificacion_asistencia_sesion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

-- 6. Snapshot puntual usando verificacion_asistencia_registro (para acta)
CREATE OR REPLACE FUNCTION calcular_verificacion_quorum_snapshot(
  p_asamblea_id UUID,
  p_corte       TIMESTAMPTZ
)
RETURNS TABLE (
  total_verificados      INT,
  coeficiente_verificado NUMERIC(12, 6),
  porcentaje_verificado  NUMERIC(6, 2),
  quorum_alcanzado       BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
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

  RETURN QUERY
  SELECT
    COUNT(DISTINCT r.quorum_asamblea_id)::INT,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6),
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2) ELSE 0 END::NUMERIC(6, 2),
    CASE WHEN v_coef_total > 0 THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50 ELSE false END
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  WHERE r.asamblea_id = p_asamblea_id
    AND r.creado_en <= p_corte;
END;
$$;

-- 7. Per-pregunta: snapshot desde verificacion_asistencia_registro (verificado para esa pregunta o en general hasta el corte)
CREATE OR REPLACE FUNCTION calcular_verificacion_por_preguntas(
  p_asamblea_id UUID
)
RETURNS TABLE (
  pregunta_id            UUID,
  total_verificados      INT,
  coeficiente_verificado NUMERIC(12, 6),
  porcentaje_verificado  NUMERIC(6, 2),
  quorum_alcanzado       BOOLEAN,
  corte_timestamp        TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
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

  RETURN QUERY
  WITH cortes AS (
    SELECT
      p.id AS pregunta_id,
      COALESCE(
        (SELECT MAX(hv.fecha_accion) FROM historial_votos hv JOIN votos v2 ON v2.id = hv.voto_id WHERE v2.pregunta_id = p.id),
        NOW()
      ) AS corte
    FROM preguntas p
    WHERE p.asamblea_id = p_asamblea_id
  ),
  -- Unidades distintas que verificaron para esta pregunta o en general hasta el corte
  unidades_por_corte AS (
    SELECT DISTINCT c.pregunta_id, c.corte, r.quorum_asamblea_id
    FROM cortes c
    LEFT JOIN verificacion_asistencia_registro r
      ON  r.asamblea_id = p_asamblea_id
      AND r.creado_en <= c.corte
      AND (r.pregunta_id = c.pregunta_id OR r.pregunta_id IS NULL)
  ),
  snaps AS (
    SELECT
      u.pregunta_id,
      u.corte,
      COUNT(u.quorum_asamblea_id)::INT AS total_v,
      COALESCE(SUM(un.coeficiente), 0)::NUMERIC(12, 6) AS coef_v
    FROM unidades_por_corte u
    LEFT JOIN quorum_asamblea qa ON qa.id = u.quorum_asamblea_id
    LEFT JOIN unidades un ON un.id = qa.unidad_id
    GROUP BY u.pregunta_id, u.corte
  )
  SELECT
    s.pregunta_id,
    s.total_v,
    s.coef_v,
    CASE WHEN v_coef_total > 0 THEN ROUND(s.coef_v / v_coef_total * 100, 2) ELSE 0 END::NUMERIC(6, 2),
    CASE WHEN v_coef_total > 0 THEN (s.coef_v / v_coef_total * 100) > 50 ELSE false END,
    s.corte
  FROM snaps s;
END;
$$;
COMMENT ON FUNCTION calcular_verificacion_por_preguntas(UUID) IS
  'Por pregunta: snapshot de verificación (registro por pregunta o general) hasta el corte del último voto.';
