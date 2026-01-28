-- =====================================================
-- SISTEMA DE CÓDIGOS DE ACCESO PARA VOTACIÓN
-- =====================================================
-- Genera códigos únicos para que los residentes
-- accedan a votar en las asambleas
-- =====================================================

-- =====================================================
-- 1. Agregar columna de código a asambleas
-- =====================================================
ALTER TABLE asambleas
ADD COLUMN IF NOT EXISTS codigo_acceso TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS url_publica TEXT,
ADD COLUMN IF NOT EXISTS acceso_publico BOOLEAN DEFAULT false;

COMMENT ON COLUMN asambleas.codigo_acceso IS 'Código único de 8 caracteres para acceso público (ej: A2K9-X7M4)';
COMMENT ON COLUMN asambleas.url_publica IS 'URL completa generada automáticamente';
COMMENT ON COLUMN asambleas.acceso_publico IS 'Si true, permite votación pública con el código';

-- =====================================================
-- 2. Función: Generar código único alfanumérico
-- =====================================================
CREATE OR REPLACE FUNCTION generar_codigo_acceso()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin 0,O,1,I para evitar confusión
  result TEXT := '';
  i INT;
BEGIN
  -- Genera código tipo: A2K9-X7M4 (8 caracteres con guión)
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  result := result || '-';
  
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generar_codigo_acceso IS 'Genera código alfanumérico único tipo A2K9-X7M4';

-- =====================================================
-- 3. Función: Activar votación pública
-- =====================================================
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
  -- Verificar que la asamblea existe
  IF NOT EXISTS (SELECT 1 FROM asambleas WHERE id = p_asamblea_id) THEN
    RAISE EXCEPTION 'La asamblea no existe';
  END IF;

  -- Verificar si ya tiene código
  SELECT codigo_acceso INTO v_codigo
  FROM asambleas
  WHERE id = p_asamblea_id;

  -- Si no tiene código, generar uno único
  IF v_codigo IS NULL THEN
    LOOP
      v_codigo := generar_codigo_acceso();
      v_intentos := v_intentos + 1;
      
      -- Verificar que sea único
      IF NOT EXISTS (SELECT 1 FROM asambleas WHERE codigo_acceso = v_codigo) THEN
        EXIT; -- Código único encontrado
      END IF;
      
      IF v_intentos >= v_max_intentos THEN
        RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', v_max_intentos;
      END IF;
    END LOOP;
  END IF;

  -- Generar URL
  v_url := p_base_url || '/votar/' || v_codigo;

  -- Actualizar asamblea
  UPDATE asambleas
  SET 
    codigo_acceso = v_codigo,
    url_publica = v_url,
    acceso_publico = true
  WHERE id = p_asamblea_id;

  -- Retornar resultado
  RETURN QUERY
  SELECT 
    v_codigo AS codigo,
    v_url AS url,
    'Votación pública activada exitosamente' AS mensaje;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION activar_votacion_publica IS 'Activa el acceso público y genera código único para la asamblea';

-- =====================================================
-- 4. Función: Desactivar votación pública
-- =====================================================
CREATE OR REPLACE FUNCTION desactivar_votacion_publica(p_asamblea_id UUID)
RETURNS TEXT AS $$
BEGIN
  UPDATE asambleas
  SET acceso_publico = false
  WHERE id = p_asamblea_id;
  
  RETURN 'Acceso público desactivado. El código sigue existiendo pero no permite votar.';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION desactivar_votacion_publica IS 'Desactiva temporalmente el acceso sin eliminar el código';

-- =====================================================
-- 5. Función: Validar código de acceso
-- =====================================================
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
    a.fecha,
    a.organization_id,
    a.acceso_publico,
    o.name AS nombre_conjunto
  INTO v_asamblea
  FROM asambleas a
  JOIN organizations o ON a.organization_id = o.id
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

COMMENT ON FUNCTION validar_codigo_acceso IS 'Valida un código de acceso y retorna info de la asamblea';

-- =====================================================
-- 6. Función: Validar votante en asamblea
-- =====================================================
CREATE OR REPLACE FUNCTION validar_votante_asamblea(
  p_codigo_asamblea TEXT,
  p_email_votante TEXT
)
RETURNS TABLE (
  puede_votar BOOLEAN,
  unidades_propias UUID[],
  unidades_poderes UUID[],
  total_unidades INT,
  total_coeficiente NUMERIC,
  mensaje TEXT
) AS $$
DECLARE
  v_asamblea_id UUID;
  v_organization_id UUID;
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_total_coef NUMERIC;
BEGIN
  -- Validar código de asamblea
  SELECT asamblea_id, organization_id INTO v_asamblea_id, v_organization_id
  FROM validar_codigo_acceso(p_codigo_asamblea)
  WHERE acceso_valido = true;

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY
    SELECT 
      false AS puede_votar,
      NULL::UUID[],
      NULL::UUID[],
      0 AS total_unidades,
      0::NUMERIC AS total_coeficiente,
      'Código de asamblea inválido' AS mensaje;
    RETURN;
  END IF;

  -- Buscar unidades propias (donde el email coincide)
  SELECT ARRAY_AGG(id)
  INTO v_unidades_propias
  FROM unidades
  WHERE organization_id = v_organization_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(p_email_votante));

  -- Buscar unidades con poderes activos
  SELECT ARRAY_AGG(p.unidad_otorgante_id)
  INTO v_unidades_poderes
  FROM poderes p
  WHERE p.asamblea_id = v_asamblea_id
    AND p.estado = 'activo'
    AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(p_email_votante));

  -- Si no tiene unidades propias ni poderes
  IF v_unidades_propias IS NULL AND v_unidades_poderes IS NULL THEN
    RETURN QUERY
    SELECT 
      false AS puede_votar,
      NULL::UUID[],
      NULL::UUID[],
      0 AS total_unidades,
      0::NUMERIC AS total_coeficiente,
      'Este email no tiene unidades ni poderes registrados en este conjunto' AS mensaje;
    RETURN;
  END IF;

  -- Calcular coeficiente total
  SELECT COALESCE(SUM(coeficiente), 0)
  INTO v_total_coef
  FROM unidades
  WHERE id = ANY(COALESCE(v_unidades_propias, ARRAY[]::UUID[]) || COALESCE(v_unidades_poderes, ARRAY[]::UUID[]));

  -- Todo OK
  RETURN QUERY
  SELECT 
    true AS puede_votar,
    COALESCE(v_unidades_propias, ARRAY[]::UUID[]) AS unidades_propias,
    COALESCE(v_unidades_poderes, ARRAY[]::UUID[]) AS unidades_poderes,
    COALESCE(array_length(v_unidades_propias, 1), 0) + COALESCE(array_length(v_unidades_poderes, 1), 0) AS total_unidades,
    v_total_coef AS total_coeficiente,
    'Votante válido' AS mensaje;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_votante_asamblea IS 'Valida si un email puede votar y retorna sus unidades (propias + poderes)';

-- =====================================================
-- 7. Índices para optimizar búsquedas
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_asambleas_codigo ON asambleas(codigo_acceso) WHERE codigo_acceso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asambleas_acceso_publico ON asambleas(acceso_publico) WHERE acceso_publico = true;
