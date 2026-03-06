-- ============================================================
-- Al cerrar la verificación, el snapshot debe contar solo la
-- sesión que se está cerrando (pop-up + registro manual de esta
-- sesión), no registros de verificaciones manuales o pop-up de
-- sesiones anteriores.
--
-- Se llama a calcular_verificacion_quorum(..., true) para que
-- p_solo_sesion_actual = true y solo cuente creado_en >= apertura_at
-- de la sesión abierta.
-- Requiere: ADD-VERIFICACION-SESION-ACTUAL (calcular_verificacion_quorum con 3 args)
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

  -- Desactivación: snapshot SOLO de la sesión que se cierra (pop-up + manual de esta sesión)
  FOR rec IN
    SELECT * FROM calcular_verificacion_quorum(NEW.id, OLD.verificacion_pregunta_id, true) LIMIT 1
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
  'Al activar: inserta sesión. Al desactivar: cierra sesión con snapshot solo de la sesión actual (verificaciones de esta ronda), asocia a preguntas abiertas si las hay.';

-- RPC cerrar_sesiones_verificacion_abiertas: también solo sesión actual
CREATE OR REPLACE FUNCTION cerrar_sesiones_verificacion_abiertas(p_asamblea_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pregunta_id            UUID;
  v_total_verificados       INT;
  v_coeficiente_verificado NUMERIC(12, 6);
  v_porcentaje_verificado  NUMERIC(6, 2);
  v_quorum_alcanzado       BOOLEAN;
  rec                      RECORD;
  v_updated                INT := 0;
BEGIN
  SELECT a.verificacion_pregunta_id INTO v_pregunta_id
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  FOR rec IN
    SELECT * FROM calcular_verificacion_quorum(p_asamblea_id, v_pregunta_id, true) LIMIT 1
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
    pregunta_id            = v_pregunta_id
  WHERE asamblea_id = p_asamblea_id
    AND cierre_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
