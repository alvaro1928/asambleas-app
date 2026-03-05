-- ============================================================
-- Verificación asociada a todas las preguntas abiertas al cerrar
--
-- Regla: la única forma de que una verificación quede asociada a dos
-- (o más) preguntas es que se cierre con esas preguntas abiertas al mismo tiempo.
--
-- Al desactivar verificación, el trigger:
-- 1) Obtiene las preguntas con estado = 'abierta' en ese momento.
-- 2) Si hay varias, cierra la sesión actual con la primera y crea una fila
--    adicional por cada otra pregunta abierta (mismo snapshot, mismo cierre).
-- 3) Si no hay preguntas abiertas, se usa OLD.verificacion_pregunta_id
--    (una sola pregunta o null = asamblea en general).
--
-- Requiere: ADD-SESION-PREGUNTA-ID-Y-ES-PODER (columna pregunta_id y trigger ya existentes).
-- ============================================================

CREATE OR REPLACE FUNCTION trg_verificacion_asistencia_sesion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_verificados      INT;
  v_coeficiente_verificado NUMERIC(12, 6);
  v_porcentaje_verificado  NUMERIC(6, 2);
  v_quorum_alcanzado       BOOLEAN;
  v_cierre_at              TIMESTAMPTZ := now();
  v_apertura_at            TIMESTAMPTZ;
  v_pregunta_ids           UUID[];
  rec                      RECORD;
  i                        INT;
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

  -- Preguntas que están abiertas en el momento de cerrar: la verificación se asocia a todas
  SELECT array_agg(p.id ORDER BY p.orden NULLS LAST, p.id)
    INTO v_pregunta_ids
    FROM preguntas p
    WHERE p.asamblea_id = NEW.id AND p.estado = 'abierta';

  IF v_pregunta_ids IS NULL OR array_length(v_pregunta_ids, 1) IS NULL OR array_length(v_pregunta_ids, 1) = 0 THEN
    -- Sin preguntas abiertas: una sola fila con el contexto anterior (general o la última pregunta)
    UPDATE verificacion_asamblea_sesiones
    SET
      cierre_at              = v_cierre_at,
      total_verificados      = COALESCE(v_total_verificados, 0),
      coeficiente_verificado = COALESCE(v_coeficiente_verificado, 0),
      porcentaje_verificado  = COALESCE(v_porcentaje_verificado, 0),
      quorum_alcanzado       = COALESCE(v_quorum_alcanzado, false),
      pregunta_id            = OLD.verificacion_pregunta_id
    WHERE asamblea_id = NEW.id
      AND cierre_at IS NULL;
    RETURN NEW;
  END IF;

  -- Una o más preguntas abiertas: asociar esta sesión a todas (una fila por pregunta)
  UPDATE verificacion_asamblea_sesiones
  SET
    cierre_at              = v_cierre_at,
    total_verificados      = COALESCE(v_total_verificados, 0),
    coeficiente_verificado = COALESCE(v_coeficiente_verificado, 0),
    porcentaje_verificado  = COALESCE(v_porcentaje_verificado, 0),
    quorum_alcanzado       = COALESCE(v_quorum_alcanzado, false),
    pregunta_id            = v_pregunta_ids[1]
  WHERE asamblea_id = NEW.id
    AND cierre_at IS NULL
  RETURNING apertura_at INTO v_apertura_at;

  -- Filas adicionales para el resto de preguntas abiertas (mismo snapshot)
  FOR i IN 2..array_length(v_pregunta_ids, 1) LOOP
    INSERT INTO verificacion_asamblea_sesiones (
      asamblea_id, apertura_at, cierre_at,
      total_verificados, coeficiente_verificado, porcentaje_verificado, quorum_alcanzado,
      pregunta_id
    ) VALUES (
      NEW.id, v_apertura_at, v_cierre_at,
      COALESCE(v_total_verificados, 0), COALESCE(v_coeficiente_verificado, 0),
      COALESCE(v_porcentaje_verificado, 0), COALESCE(v_quorum_alcanzado, false),
      v_pregunta_ids[i]
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_verificacion_asistencia_sesion() IS
  'Al activar: inserta sesión. Al desactivar: cierra sesión y asocia a todas las preguntas abiertas en ese momento (una fila por pregunta para el acta).';
