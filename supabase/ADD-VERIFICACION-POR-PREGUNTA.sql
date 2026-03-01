-- ============================================================
-- ADD-VERIFICACION-POR-PREGUNTA.sql
--
-- Agrega dos funciones RPC para el acta:
--
--  1. calcular_verificacion_quorum_snapshot(asamblea_id, corte)
--     → snapshot de verificación en un momento dado (útil para
--       mostrar qué % había verificado ANTES de una pregunta).
--
--  2. calcular_verificacion_por_preguntas(asamblea_id)
--     → para cada pregunta devuelve el snapshot de verificación
--       usando como corte el timestamp del ÚLTIMO voto de esa
--       pregunta (o NOW() si aún no tiene votos).
--       También incluye la primera verificación registrada
--       (verificacion_inicial) para el acta introductoria.
--
-- EJECUTAR en Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. Snapshot puntual de verificación ──────────────────────
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
  JOIN unidades u ON u.id = qa.unidad_id
  WHERE qa.asamblea_id = p_asamblea_id
    AND qa.verifico_asistencia = true
    -- Incluir filas sin hora_verificacion (registradas antes de esta columna)
    AND (qa.hora_verificacion IS NULL OR qa.hora_verificacion <= p_corte);
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum_snapshot(UUID, TIMESTAMPTZ) IS
  'Snapshot de verificación de asistencia hasta el momento p_corte. Útil para el acta.';


-- ── 2. Per-pregunta: snapshot al momento del último voto ──────
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
  WITH -- Corte por pregunta = MAX fecha_accion en historial_votos para esa pregunta
       -- Si no hay votos aún, usamos NOW() para mostrar el estado actual
       cortes AS (
         SELECT
           p.id                                            AS pregunta_id,
           COALESCE(
             (
               SELECT MAX(hv.fecha_accion)
                 FROM historial_votos hv
                 JOIN votos v2 ON v2.id = hv.voto_id
                WHERE v2.pregunta_id = p.id
             ),
             NOW()
           )                                              AS corte
         FROM preguntas p
        WHERE p.asamblea_id = p_asamblea_id
       ),
       -- Para cada corte, contar verificados hasta ese momento
       snaps AS (
         SELECT
           c.pregunta_id,
           c.corte,
           COUNT(qa.id)::INT                                  AS total_v,
           COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)   AS coef_v
         FROM cortes c
         LEFT JOIN quorum_asamblea qa
               ON  qa.asamblea_id = p_asamblea_id
               AND qa.verifico_asistencia = true
               AND (qa.hora_verificacion IS NULL OR qa.hora_verificacion <= c.corte)
         LEFT JOIN unidades u ON u.id = qa.unidad_id
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
  'Para cada pregunta de la asamblea devuelve el snapshot de verificación de asistencia
   usando como corte el timestamp del último voto de esa pregunta (o NOW() si no hay votos).
   Permite mostrar en el acta cuántos habían verificado al momento exacto de cada votación.';
