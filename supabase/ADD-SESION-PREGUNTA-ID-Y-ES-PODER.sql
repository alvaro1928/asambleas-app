-- ============================================================
-- Sesión con pregunta_id + RPC (unidad_id, es_poder) para listas
-- - verificacion_asamblea_sesiones: columna pregunta_id (general vs por pregunta).
-- - Trigger de cierre: setear pregunta_id = OLD.verificacion_pregunta_id.
-- - Unidades verificadas en sesión actual con flag es_poder (para etiqueta "Poder").
-- Requiere: ADD-VERIFICACION-SESION-ACTUAL, ADD-VERIFICACION-ASISTENCIA-POR-PREGUNTA
-- ============================================================

-- 1. Columna pregunta_id en sesiones (null = asamblea en general; no null = sesión asociada a esa pregunta)
ALTER TABLE verificacion_asamblea_sesiones
  ADD COLUMN IF NOT EXISTS pregunta_id UUID REFERENCES preguntas(id) ON DELETE SET NULL;

COMMENT ON COLUMN verificacion_asamblea_sesiones.pregunta_id IS
  'Al cerrar: null = verificación general (sin pregunta); no null = verificación asociada a esa pregunta. Para el acta: general = solo sesiones con pregunta_id IS NULL.';

-- 2. Trigger: al desactivar verificación, cerrar sesión y guardar pregunta_id del contexto
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
    quorum_alcanzado       = COALESCE(v_quorum_alcanzado, false),
    pregunta_id            = OLD.verificacion_pregunta_id
  WHERE asamblea_id = NEW.id
    AND cierre_at IS NULL;

  RETURN NEW;
END;
$$;

-- 3. Unidades verificadas en sesión actual con es_poder (para listas "Ya verificaron" con etiqueta Poder)
--    Reemplaza unidad_ids_verificados_sesion_actual para devolver también es_poder; callers que solo usan unidad_id siguen funcionando.
CREATE OR REPLACE FUNCTION unidad_ids_verificados_sesion_actual(
  p_asamblea_id UUID,
  p_pregunta_id UUID DEFAULT NULL
)
RETURNS TABLE (unidad_id UUID, es_poder BOOLEAN)
LANGUAGE sql
STABLE
AS $$
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
    END
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND r.creado_en >= (
      SELECT s.apertura_at
      FROM verificacion_asamblea_sesiones s
      WHERE s.asamblea_id = p_asamblea_id
        AND s.cierre_at IS NULL
      ORDER BY s.apertura_at DESC
      LIMIT 1
    )
  ORDER BY qa.unidad_id;
$$;

COMMENT ON FUNCTION unidad_ids_verificados_sesion_actual(UUID, UUID) IS
  'Unidad IDs que verificaron asistencia en la sesión actual (desde la última apertura). es_poder=true si verificó mediante poder notarial.';
