-- ============================================================
-- ADD-VERIFICACION-ASISTENCIA-SESIONES.sql
--
-- Registra cada vez que se abre/cierra la verificación de asistencia
-- (asamblea en general) para que el acta pueda listar múltiples
-- sesiones con hora y fecha (ej.: preguntas cerradas, abrir 2 veces
-- verificación = 2 registros en el acta).
--
-- Al ACTIVAR verificación: se inserta una fila con apertura_at.
-- Al DESACTIVAR verificación: se actualiza esa fila con cierre_at
-- y el snapshot (total_verificados, coeficiente, %, quorum) en ese momento.
-- ============================================================

-- Tabla de sesiones de verificación (asamblea en general)
CREATE TABLE IF NOT EXISTS verificacion_asamblea_sesiones (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id            UUID NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  apertura_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  cierre_at              TIMESTAMPTZ,
  total_verificados      INT,
  coeficiente_verificado NUMERIC(12, 6),
  porcentaje_verificado  NUMERIC(6, 2),
  quorum_alcanzado       BOOLEAN
);

COMMENT ON TABLE verificacion_asamblea_sesiones IS
  'Cada fila = una vez que se abrió la verificación de asistencia (asamblea en general). Al cerrar se rellena cierre_at y el snapshot.';

CREATE INDEX IF NOT EXISTS idx_verif_sesiones_asamblea
  ON verificacion_asamblea_sesiones(asamblea_id);

-- Función llamada por el trigger: al activar inserta sesión; al desactivar actualiza con snapshot
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
  -- Solo nos interesa el cambio del flag
  IF OLD.verificacion_asistencia_activa IS NOT DISTINCT FROM NEW.verificacion_asistencia_activa THEN
    RETURN NEW;
  END IF;

  IF NEW.verificacion_asistencia_activa = true THEN
    -- Activación: nueva sesión abierta
    INSERT INTO verificacion_asamblea_sesiones (asamblea_id, apertura_at)
    VALUES (NEW.id, now());
    RETURN NEW;
  END IF;

  -- Desactivación: tomar snapshot actual (antes de que la app resetee quorum_asamblea) y cerrar la sesión abierta
  FOR rec IN
    SELECT * FROM calcular_verificacion_quorum(NEW.id) LIMIT 1
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

DROP TRIGGER IF EXISTS trg_asambleas_verificacion_sesion ON asambleas;
CREATE TRIGGER trg_asambleas_verificacion_sesion
  AFTER UPDATE OF verificacion_asistencia_activa ON asambleas
  FOR EACH ROW
  EXECUTE PROCEDURE trg_verificacion_asistencia_sesion();

COMMENT ON FUNCTION trg_verificacion_asistencia_sesion() IS
  'Al activar verificación inserta una sesión; al desactivar actualiza la sesión abierta con cierre_at y snapshot.';
