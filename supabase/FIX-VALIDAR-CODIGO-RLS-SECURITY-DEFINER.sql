-- =====================================================
-- validar_codigo_acceso: SECURITY DEFINER (compatible con RLS / hardening)
-- =====================================================
-- Tras ETAPA 1–3 de hardening RLS, la función se ejecutaba como INVOKER.
-- Un usuario authenticated (p. ej. admin con sesión abierta en el mismo navegador)
-- solo ve asambleas de su organización; al abrir /votar de OTRA organización el
-- SELECT no encuentra fila → "código inválido" / acceso denegado, mientras que
-- anon (típico móvil sin login) sí veía filas con acceso_publico = true.
--
-- Esta función debe validar el código de forma independiente del rol del llamador:
-- SECURITY DEFINER + search_path fijo.
-- =====================================================

CREATE OR REPLACE FUNCTION public.validar_codigo_acceso(p_codigo TEXT)
RETURNS TABLE (
  asamblea_id UUID,
  nombre TEXT,
  fecha DATE,
  organization_id UUID,
  nombre_conjunto TEXT,
  acceso_valido BOOLEAN,
  mensaje TEXT,
  participacion_timer_end_at TIMESTAMPTZ,
  participacion_timer_default_minutes INTEGER,
  participacion_timer_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_asamblea RECORD;
BEGIN
  SELECT
    a.id,
    a.nombre,
    a.fecha::DATE,
    a.organization_id,
    a.acceso_publico,
    COALESCE(o.name, 'Sin nombre') AS nombre_conjunto,
    a.participacion_timer_end_at,
    a.participacion_timer_default_minutes,
    a.participacion_timer_enabled
  INTO v_asamblea
  FROM public.asambleas a
  LEFT JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo));

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      NULL::UUID,
      NULL::TEXT,
      NULL::DATE,
      NULL::UUID,
      NULL::TEXT,
      false AS acceso_valido,
      'Código de acceso inválido o no existe'::TEXT AS mensaje,
      NULL::TIMESTAMPTZ,
      5,
      true AS participacion_timer_enabled;
    RETURN;
  END IF;

  IF NOT v_asamblea.acceso_publico THEN
    RETURN QUERY
    SELECT
      v_asamblea.id,
      v_asamblea.nombre,
      v_asamblea.fecha,
      v_asamblea.organization_id,
      v_asamblea.nombre_conjunto,
      false AS acceso_valido,
      'El acceso público a esta asamblea está desactivado'::TEXT AS mensaje,
      v_asamblea.participacion_timer_end_at,
      COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
      COALESCE(v_asamblea.participacion_timer_enabled, true);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_asamblea.id,
    v_asamblea.nombre,
    v_asamblea.fecha,
    v_asamblea.organization_id,
    v_asamblea.nombre_conjunto,
    true AS acceso_valido,
    'Código válido. Acceso permitido.'::TEXT AS mensaje,
    v_asamblea.participacion_timer_end_at,
    COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
    COALESCE(v_asamblea.participacion_timer_enabled, true);
END;
$$;

-- En PG15+ el RLS puede aplicarse aún dentro de SECURITY DEFINER; desactivar row_security
-- solo para esta función (lectura controlada por la lógica de la función).
ALTER FUNCTION public.validar_codigo_acceso(TEXT) SET row_security = off;

COMMENT ON FUNCTION public.validar_codigo_acceso(TEXT) IS
  'Valida código de acceso público; SECURITY DEFINER para no depender del RLS del rol invocador (post-hardening).';

GRANT EXECUTE ON FUNCTION public.validar_codigo_acceso(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validar_codigo_acceso(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_codigo_acceso(TEXT) TO service_role;
