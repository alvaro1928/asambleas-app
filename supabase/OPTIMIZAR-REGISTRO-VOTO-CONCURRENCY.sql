-- =====================================================
-- OPTIMIZACIÓN: registro de voto bajo concurrencia (500+ votantes)
-- =====================================================
-- Evita bloqueos y condiciones de carrera usando
-- SELECT ... FOR UPDATE para bloquear la fila (pregunta_id, unidad_id)
-- antes de INSERT/UPDATE. Ejecutar en Supabase SQL Editor.
-- =====================================================

CREATE OR REPLACE FUNCTION registrar_voto_con_trazabilidad(
  p_pregunta_id UUID,
  p_unidad_id UUID,
  p_opcion_id UUID,
  p_votante_email TEXT,
  p_votante_nombre TEXT,
  p_es_poder BOOLEAN DEFAULT false,
  p_poder_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  voto_id UUID,
  accion TEXT,
  mensaje TEXT
) AS $$
DECLARE
  v_voto_existente UUID;
  v_opcion_anterior UUID;
  v_nuevo_voto_id UUID;
  v_accion TEXT;
BEGIN
  -- Verificar si la pregunta está abierta
  IF NOT EXISTS (
    SELECT 1 FROM preguntas
    WHERE id = p_pregunta_id AND estado = 'abierta'
  ) THEN
    RAISE EXCEPTION 'La pregunta no está abierta para votación';
  END IF;

  -- Bloquear fila existente (si hay) para evitar race condition y deadlocks
  -- FOR UPDATE asegura que dos transacciones no inserten/actualicen la misma unidad a la vez
  SELECT id, opcion_id INTO v_voto_existente, v_opcion_anterior
  FROM votos
  WHERE pregunta_id = p_pregunta_id
    AND unidad_id = p_unidad_id
  FOR UPDATE;

  IF v_voto_existente IS NOT NULL THEN
    -- Ya votó, actualizar (modificación)
    v_accion := 'modificar';

    UPDATE votos
    SET
      opcion_id = p_opcion_id,
      votante_email = p_votante_email,
      votante_nombre = p_votante_nombre,
      es_poder = p_es_poder,
      poder_id = p_poder_id
    WHERE id = v_voto_existente;

    v_nuevo_voto_id := v_voto_existente;
  ELSE
    -- Primera vez que vota (creación)
    v_accion := 'crear';

    INSERT INTO votos (
      pregunta_id, unidad_id, opcion_id,
      votante_email, votante_nombre, es_poder, poder_id
    )
    VALUES (
      p_pregunta_id, p_unidad_id, p_opcion_id,
      p_votante_email, p_votante_nombre, p_es_poder, p_poder_id
    )
    RETURNING id INTO v_nuevo_voto_id;
  END IF;

  -- Registrar en historial (trazabilidad)
  INSERT INTO historial_votos (
    voto_id, pregunta_id, unidad_id, opcion_id,
    votante_email, votante_nombre, es_poder, poder_id,
    accion, opcion_anterior_id, ip_address, user_agent
  )
  VALUES (
    v_nuevo_voto_id, p_pregunta_id, p_unidad_id, p_opcion_id,
    p_votante_email, p_votante_nombre, p_es_poder, p_poder_id,
    v_accion, v_opcion_anterior, p_ip_address, p_user_agent
  );

  RETURN QUERY
  SELECT
    v_nuevo_voto_id AS voto_id,
    v_accion AS accion,
    CASE
      WHEN v_accion = 'crear' THEN 'Voto registrado exitosamente'
      ELSE 'Voto actualizado exitosamente'
    END AS mensaje;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_voto_con_trazabilidad IS 'Registra o modifica un voto con trazabilidad. Usa FOR UPDATE para concurrencia (500+ votantes).';
