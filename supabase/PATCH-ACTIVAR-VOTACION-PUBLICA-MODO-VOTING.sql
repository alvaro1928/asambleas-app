-- Ejecutar en Supabase SQL Editor si ya tenías desplegada una versión anterior de
-- activar_votacion_publica que ponía session_mode = 'verification'.
-- Tras esto, "Activar votación pública" deja la sesión en modo votación (equivalente al antiguo botón "Iniciar votación").

CREATE OR REPLACE FUNCTION activar_votacion_publica(
  p_asamblea_id UUID,
  p_base_url TEXT DEFAULT 'https://tu-dominio.com'
)
RETURNS TABLE (
  codigo TEXT,
  url TEXT,
  mensaje TEXT
) AS $$
DECLARE
  v_codigo TEXT;
  v_url TEXT;
  v_intentos INT := 0;
  v_max_intentos INT := 10;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM asambleas WHERE id = p_asamblea_id) THEN
    RAISE EXCEPTION 'La asamblea no existe';
  END IF;

  SELECT codigo_acceso INTO v_codigo FROM asambleas WHERE id = p_asamblea_id;

  IF v_codigo IS NULL THEN
    LOOP
      v_codigo := generar_codigo_acceso();
      v_intentos := v_intentos + 1;
      IF NOT EXISTS (SELECT 1 FROM asambleas WHERE codigo_acceso = v_codigo) THEN
        EXIT;
      END IF;
      IF v_intentos >= v_max_intentos THEN
        RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', v_max_intentos;
      END IF;
    END LOOP;
  END IF;

  v_url := p_base_url || '/votar/' || v_codigo;

  UPDATE asambleas
  SET
    codigo_acceso = v_codigo,
    url_publica = v_url,
    acceso_publico = true,
    session_mode = 'voting'
  WHERE id = p_asamblea_id;

  RETURN QUERY
  SELECT v_codigo, v_url, 'Votación pública activada exitosamente'::TEXT;
END;
$$ LANGUAGE plpgsql;
