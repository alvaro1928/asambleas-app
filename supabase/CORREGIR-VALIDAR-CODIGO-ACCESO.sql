-- =====================================================
-- CORRECCIÓN: validar_codigo_acceso
-- =====================================================
-- Error: El tipo de fecha no coincide
-- Solución: Convertir TIMESTAMP a DATE
-- =====================================================

DROP FUNCTION IF EXISTS validar_codigo_acceso(TEXT);

CREATE OR REPLACE FUNCTION validar_codigo_acceso(p_codigo TEXT)
RETURNS TABLE (
  asamblea_id UUID,
  nombre TEXT,
  fecha DATE,
  organization_id UUID,
  nombre_conjunto TEXT,
  acceso_valido BOOLEAN,
  mensaje TEXT
) AS $$
DECLARE
  v_asamblea RECORD;
BEGIN
  -- Buscar asamblea por código
  SELECT 
    a.id,
    a.nombre,
    a.fecha::DATE,  -- ← CORRECCIÓN: Convertir a DATE
    a.organization_id,
    a.acceso_publico,
    COALESCE(o.name, 'Sin nombre') AS nombre_conjunto  -- ← Manejar NULL
  INTO v_asamblea
  FROM asambleas a
  LEFT JOIN organizations o ON a.organization_id = o.id
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo));

  -- Si no existe el código
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      NULL::UUID,
      NULL::TEXT,
      NULL::DATE,
      NULL::UUID,
      NULL::TEXT,
      false AS acceso_valido,
      'Código de acceso inválido o no existe' AS mensaje;
    RETURN;
  END IF;

  -- Si el acceso no está activo
  IF NOT v_asamblea.acceso_publico THEN
    RETURN QUERY
    SELECT 
      v_asamblea.id,
      v_asamblea.nombre,
      v_asamblea.fecha,
      v_asamblea.organization_id,
      v_asamblea.nombre_conjunto,
      false AS acceso_valido,
      'El acceso público a esta asamblea está desactivado' AS mensaje;
    RETURN;
  END IF;

  -- Todo OK
  RETURN QUERY
  SELECT 
    v_asamblea.id,
    v_asamblea.nombre,
    v_asamblea.fecha,
    v_asamblea.organization_id,
    v_asamblea.nombre_conjunto,
    true AS acceso_valido,
    'Código válido. Acceso permitido.' AS mensaje;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_codigo_acceso IS 'Valida un código de acceso y retorna info de la asamblea (CORREGIDO)';

-- =====================================================
-- PROBAR LA FUNCIÓN CORREGIDA
-- =====================================================

SELECT * FROM validar_codigo_acceso('5759-4RXE');

-- Ahora debería funcionar correctamente ✅
