-- ============================================================
-- ADD-VERIFICACION-ASISTENCIA.sql
--
-- Agrega soporte para el flujo "Verificación de Quórum":
--   1. El administrador activa la verificación desde el Centro de Control.
--   2. La página de votación detecta el flag (vía polling) y muestra
--      un popup al votante para que confirme su asistencia.
--   3. El sistema registra quién verificó y calcula el % de quórum
--      verificado según Ley 675 de 2001, Art. 45 (>50% coeficientes).
-- ============================================================

-- 1. Flag en asambleas: el administrador activa/desactiva el popup
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS verificacion_asistencia_activa BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN asambleas.verificacion_asistencia_activa IS
  'Cuando es true, la página de votación muestra a los votantes el popup de confirmación de asistencia.';

-- 2. Registro individual por unidad en quorum_asamblea
ALTER TABLE quorum_asamblea
  ADD COLUMN IF NOT EXISTS verifico_asistencia BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE quorum_asamblea
  ADD COLUMN IF NOT EXISTS hora_verificacion TIMESTAMPTZ;

COMMENT ON COLUMN quorum_asamblea.verifico_asistencia IS
  'True cuando el votante hizo clic en "Verifiqué Asistencia" durante la verificación activada por el admin.';

COMMENT ON COLUMN quorum_asamblea.hora_verificacion IS
  'Timestamp en que el votante confirmó su asistencia.';

-- 3. Índice para consultas rápidas de verificados por asamblea
CREATE INDEX IF NOT EXISTS idx_quorum_asamblea_verifico
  ON quorum_asamblea(asamblea_id)
  WHERE verifico_asistencia = true;

-- ============================================================
-- FUNCIÓN: calcular_verificacion_quorum
--
-- Retorna el resumen de verificaciones de asistencia para una
-- asamblea: total de unidades verificadas, suma de coeficientes
-- y porcentaje sobre el coeficiente total del conjunto.
--
-- Umbral Ley 675 Art. 45: quórum = coeficiente verificado > 50%
-- ============================================================
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
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
BEGIN
  -- Obtener organización y si es demo para filtrar unidades correctas
  SELECT a.organization_id, a.is_demo
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Coeficiente total del conjunto (igual lógica que calcular_quorum_asamblea)
  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND u.is_demo = v_is_demo;

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
  JOIN unidades u ON u.id = qa.unidad_id
  WHERE qa.asamblea_id = p_asamblea_id
    AND qa.verifico_asistencia = true;
END;
$$;

COMMENT ON FUNCTION calcular_verificacion_quorum(UUID) IS
  'Calcula cuántas unidades verificaron asistencia y su coeficiente acumulado.
   quorum_alcanzado = true cuando el coeficiente verificado supera el 50% (Ley 675 Art. 45, primera convocatoria).';
