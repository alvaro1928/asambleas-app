-- ============================================================
-- Cerrar sesiones de verificación abiertas al finalizar asamblea
--
-- RPC para invocar desde el frontend al hacer "Finalizar asamblea":
-- cierra cualquier fila en verificacion_asamblea_sesiones con
-- cierre_at IS NULL, usando el contexto actual de la asamblea
-- (verificacion_pregunta_id). Así no quedan sesiones sin cierre
-- y el acta solo muestra sesiones cerradas.
--
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================

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
    SELECT * FROM calcular_verificacion_quorum(p_asamblea_id, v_pregunta_id) LIMIT 1
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

COMMENT ON FUNCTION cerrar_sesiones_verificacion_abiertas(UUID) IS
  'Cierra todas las sesiones de verificación abiertas (cierre_at IS NULL) de la asamblea, con snapshot actual. Llamar antes de finalizar la asamblea.';
