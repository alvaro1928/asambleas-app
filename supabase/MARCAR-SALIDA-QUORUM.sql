-- =====================================================
-- Marcar salida en quórum (solo sesiones activas en registro)
-- =====================================================
-- Al llamar esta función, se pone presente_virtual = false
-- para todas las filas de ese votante en esa asamblea.
-- Así el "Registro de Ingresos en Tiempo Real" solo muestra
-- quienes siguen con sesión activa.
-- =====================================================

CREATE OR REPLACE FUNCTION marcar_salida_quorum(
  p_asamblea_id UUID,
  p_email_votante TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quorum_asamblea
  SET presente_virtual = false
  WHERE asamblea_id = p_asamblea_id
    AND LOWER(TRIM(email_propietario)) = LOWER(TRIM(p_email_votante));
END;
$$;

COMMENT ON FUNCTION marcar_salida_quorum IS 'Marca como salida (presente_virtual=false) para el registro de ingresos en tiempo real';

-- Permitir que la API (anon) llame a la función
GRANT EXECUTE ON FUNCTION marcar_salida_quorum(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION marcar_salida_quorum(UUID, TEXT) TO authenticated;
