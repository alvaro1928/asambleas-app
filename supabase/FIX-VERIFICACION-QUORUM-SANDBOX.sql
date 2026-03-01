-- ============================================================
-- FIX-VERIFICACION-QUORUM-SANDBOX.sql
--
-- Corrige las funciones de verificación de asistencia para
-- que respeten sandbox_usar_unidades_reales, igual que
-- calcular_quorum_asamblea y calcular_estadisticas_pregunta.
--
-- Lógica:
--   is_demo=false                         → unidades is_demo=false (reales)
--   is_demo=true, sandbox_reales=false    → unidades is_demo=true  (10 demo)
--   is_demo=true, sandbox_reales=true     → unidades is_demo=false (reales)
--
-- EJECUTAR en Supabase → SQL Editor → Run
-- ============================================================


-- ── 1. calcular_verificacion_quorum ─────────────────────────
CREATE OR REPLACE FUNCTION calcular_verificacion_quorum(p_asamblea_id UUID)
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
  v_organization_id  UUID;
  v_is_demo          BOOLEAN;
  v_sandbox_reales   BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total       NUMERIC(12, 6);
BEGIN
  SELECT
    a.organization_id,
    COALESCE(a.is_demo, false),
    COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Misma lógica que calcular_quorum_asamblea
  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_coef_total
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

  RETURN QUERY
  SELECT
    COUNT(qa.id)::INT                                             AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)              AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                           AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                          AS quorum_alcanzado
  FROM quorum_asamblea qa
  JOIN unidades u
    ON u.id = qa.unidad_id
   AND u.organization_id = v_organization_id
   AND COALESCE(u.is_demo, false) = v_unidades_is_demo
  WHERE qa.asamblea_id = p_asamblea_id
    AND qa.verifico_asistencia = true;
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum(UUID) IS
  'Calcula cuántas unidades verificaron asistencia. Respeta sandbox_usar_unidades_reales
   igual que calcular_quorum_asamblea. quorum_alcanzado = coef verificado > 50% (Ley 675 Art. 45).';


-- ── 2. calcular_verificacion_quorum_snapshot ────────────────
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
  v_organization_id  UUID;
  v_is_demo          BOOLEAN;
  v_sandbox_reales   BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total       NUMERIC(12, 6);
BEGIN
  SELECT
    a.organization_id,
    COALESCE(a.is_demo, false),
    COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_coef_total
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

  RETURN QUERY
  SELECT
    COUNT(qa.id)::INT                                    AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)     AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                   AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                  AS quorum_alcanzado
  FROM quorum_asamblea qa
  JOIN unidades u
    ON u.id = qa.unidad_id
   AND u.organization_id = v_organization_id
   AND COALESCE(u.is_demo, false) = v_unidades_is_demo
  WHERE qa.asamblea_id = p_asamblea_id
    AND qa.verifico_asistencia = true
    AND (qa.hora_verificacion IS NULL OR qa.hora_verificacion <= p_corte);
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum_snapshot(UUID, TIMESTAMPTZ) IS
  'Snapshot de verificación hasta p_corte. Respeta sandbox_usar_unidades_reales.';


-- ── 3. calcular_verificacion_por_preguntas ───────────────────
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
  v_organization_id  UUID;
  v_is_demo          BOOLEAN;
  v_sandbox_reales   BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total       NUMERIC(12, 6);
BEGIN
  SELECT
    a.organization_id,
    COALESCE(a.is_demo, false),
    COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_coef_total
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

  RETURN QUERY
  WITH cortes AS (
    SELECT
      p.id AS pregunta_id,
      COALESCE(
        (
          SELECT MAX(hv.fecha_accion)
          FROM historial_votos hv
          JOIN votos v2 ON v2.id = hv.voto_id
          WHERE v2.pregunta_id = p.id
        ),
        NOW()
      ) AS corte
    FROM preguntas p
    WHERE p.asamblea_id = p_asamblea_id
  ),
  snaps AS (
    SELECT
      c.pregunta_id,
      c.corte,
      COUNT(qa.id)::INT                                AS total_v,
      COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6) AS coef_v
    FROM cortes c
    LEFT JOIN quorum_asamblea qa
          ON  qa.asamblea_id = p_asamblea_id
          AND qa.verifico_asistencia = true
          AND (qa.hora_verificacion IS NULL OR qa.hora_verificacion <= c.corte)
    LEFT JOIN unidades u
          ON  u.id = qa.unidad_id
          AND u.organization_id = v_organization_id
          AND COALESCE(u.is_demo, false) = v_unidades_is_demo
    GROUP BY c.pregunta_id, c.corte
  )
  SELECT
    s.pregunta_id,
    s.total_v                                              AS total_verificados,
    s.coef_v                                               AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(s.coef_v / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                     AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (s.coef_v / v_coef_total * 100) > 50
      ELSE false
    END                                                    AS quorum_alcanzado,
    s.corte                                                AS corte_timestamp
  FROM snaps s;
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_por_preguntas(UUID) IS
  'Snapshot de verificación por pregunta usando el corte del último voto.
   Respeta sandbox_usar_unidades_reales igual que calcular_quorum_asamblea.';
