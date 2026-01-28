-- =====================================================
-- CONFIGURACIÓN DE LÍMITE DE PODERES
-- =====================================================
-- Agrega una tabla para configurar el límite máximo de poderes
-- que una persona puede recibir por conjunto

CREATE TABLE IF NOT EXISTS configuracion_poderes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  max_poderes_por_apoderado INTEGER DEFAULT 3 NOT NULL,
  requiere_documento BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  
  -- Solo una configuración por conjunto
  UNIQUE(organization_id)
);

-- Deshabilitar RLS
ALTER TABLE configuracion_poderes DISABLE ROW LEVEL SECURITY;

-- Insertar configuración por defecto para organizaciones existentes
INSERT INTO configuracion_poderes (organization_id, max_poderes_por_apoderado, requiere_documento)
SELECT id, 3, false
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

COMMENT ON TABLE configuracion_poderes IS 'Configuración de límites para poderes por conjunto';
COMMENT ON COLUMN configuracion_poderes.max_poderes_por_apoderado IS 'Número máximo de poderes que una persona puede recibir (típico: 2-3 según Ley 675)';
COMMENT ON COLUMN configuracion_poderes.requiere_documento IS 'Si es obligatorio adjuntar el documento del poder escaneado';

-- =====================================================
-- FUNCIÓN: Validar límite de poderes
-- =====================================================
CREATE OR REPLACE FUNCTION validar_limite_poderes(
  p_asamblea_id UUID,
  p_email_receptor TEXT,
  p_organization_id UUID
)
RETURNS TABLE (
  puede_recibir_poder BOOLEAN,
  poderes_actuales INTEGER,
  limite_maximo INTEGER,
  mensaje TEXT
) AS $$
DECLARE
  v_poderes_actuales INTEGER;
  v_limite_maximo INTEGER;
BEGIN
  -- Obtener límite configurado para este conjunto
  SELECT max_poderes_por_apoderado INTO v_limite_maximo
  FROM configuracion_poderes
  WHERE organization_id = p_organization_id;
  
  -- Si no hay configuración, usar límite por defecto de 3
  IF v_limite_maximo IS NULL THEN
    v_limite_maximo := 3;
  END IF;
  
  -- Contar poderes activos que ya tiene este receptor en esta asamblea
  SELECT COUNT(*) INTO v_poderes_actuales
  FROM poderes
  WHERE asamblea_id = p_asamblea_id
    AND email_receptor = p_email_receptor
    AND estado = 'activo';
  
  -- Determinar si puede recibir más poderes
  RETURN QUERY
  SELECT 
    (v_poderes_actuales < v_limite_maximo) AS puede_recibir_poder,
    v_poderes_actuales AS poderes_actuales,
    v_limite_maximo AS limite_maximo,
    CASE 
      WHEN v_poderes_actuales < v_limite_maximo THEN 'Puede recibir más poderes'
      ELSE 'Ha alcanzado el límite máximo de poderes (' || v_limite_maximo || ')'
    END AS mensaje;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_limite_poderes IS 'Valida si un apoderado puede recibir un nuevo poder según el límite configurado';

-- =====================================================
-- FUNCIÓN: Resumen de poderes de una asamblea
-- =====================================================
CREATE OR REPLACE FUNCTION resumen_poderes_asamblea(p_asamblea_id UUID)
RETURNS TABLE (
  total_poderes_activos INTEGER,
  total_unidades_delegadas INTEGER,
  coeficiente_total_delegado NUMERIC(12, 6),
  porcentaje_coeficiente NUMERIC(5, 2)
) AS $$
DECLARE
  v_organization_id UUID;
  v_coeficiente_total_conjunto NUMERIC(12, 6);
BEGIN
  -- Obtener el organization_id de la asamblea
  SELECT a.organization_id INTO v_organization_id
  FROM asambleas a
  WHERE a.id = p_asamblea_id;
  
  -- Calcular el coeficiente total del conjunto
  SELECT COALESCE(SUM(coeficiente), 0) INTO v_coeficiente_total_conjunto
  FROM unidades
  WHERE organization_id = v_organization_id;
  
  -- Calcular resumen de poderes
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_poderes_activos,
    COUNT(DISTINCT p.unidad_otorgante_id)::INTEGER AS total_unidades_delegadas,
    COALESCE(SUM(u.coeficiente), 0) AS coeficiente_total_delegado,
    CASE 
      WHEN v_coeficiente_total_conjunto > 0 THEN
        ROUND((COALESCE(SUM(u.coeficiente), 0) / v_coeficiente_total_conjunto * 100)::NUMERIC, 2)
      ELSE 0
    END AS porcentaje_coeficiente
  FROM poderes p
  JOIN unidades u ON p.unidad_otorgante_id = u.id
  WHERE p.asamblea_id = p_asamblea_id
    AND p.estado = 'activo';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION resumen_poderes_asamblea IS 'Calcula el resumen de poderes activos en una asamblea';

-- =====================================================
-- VISTA: Poderes con información completa
-- =====================================================
CREATE OR REPLACE VIEW vista_poderes_completa AS
SELECT 
  p.id,
  p.asamblea_id,
  p.unidad_otorgante_id,
  p.unidad_receptor_id,
  p.email_otorgante,
  p.nombre_otorgante,
  p.email_receptor,
  p.nombre_receptor,
  p.estado,
  p.archivo_poder,
  p.observaciones,
  p.created_at,
  p.revocado_at,
  -- Datos de la unidad otorgante
  u_otorgante.numero AS unidad_otorgante_numero,
  u_otorgante.torre AS unidad_otorgante_torre,
  u_otorgante.coeficiente AS coeficiente_delegado,
  u_otorgante.tipo AS tipo_unidad_otorgante,
  -- Datos de la unidad receptora (si existe)
  u_receptor.numero AS unidad_receptor_numero,
  u_receptor.torre AS unidad_receptor_torre,
  u_receptor.coeficiente AS coeficiente_receptor,
  -- Datos de la asamblea
  a.nombre AS asamblea_nombre,
  a.fecha AS asamblea_fecha,
  a.estado AS asamblea_estado
FROM poderes p
JOIN unidades u_otorgante ON p.unidad_otorgante_id = u_otorgante.id
LEFT JOIN unidades u_receptor ON p.unidad_receptor_id = u_receptor.id
JOIN asambleas a ON p.asamblea_id = a.id;

COMMENT ON VIEW vista_poderes_completa IS 'Vista con información completa de poderes incluyendo datos de unidades y asambleas';
