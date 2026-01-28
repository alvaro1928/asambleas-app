-- =====================================================
-- SISTEMA DE VOTOS Y PODERES (VERSIÓN CORREGIDA)
-- =====================================================
-- Permite registrar votos, gestionar poderes y calcular
-- estadísticas en tiempo real
-- =====================================================

-- =====================================================
-- TABLA: poderes (CREAR PRIMERO)
-- =====================================================
-- Gestiona los poderes otorgados entre propietarios
CREATE TABLE IF NOT EXISTS poderes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asamblea_id UUID REFERENCES asambleas(id) ON DELETE CASCADE NOT NULL,
  unidad_otorgante_id UUID REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  unidad_receptor_id UUID REFERENCES unidades(id) ON DELETE CASCADE,
  email_otorgante TEXT NOT NULL,
  nombre_otorgante TEXT,
  email_receptor TEXT NOT NULL,
  nombre_receptor TEXT,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'revocado', 'usado')) NOT NULL,
  archivo_poder TEXT, -- URL o path del documento escaneado
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  revocado_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraint: Una unidad no puede otorgar múltiples poderes activos en la misma asamblea
  UNIQUE(asamblea_id, unidad_otorgante_id, estado)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_poderes_asamblea ON poderes(asamblea_id);
CREATE INDEX IF NOT EXISTS idx_poderes_receptor ON poderes(email_receptor);
CREATE INDEX IF NOT EXISTS idx_poderes_estado ON poderes(estado);

COMMENT ON TABLE poderes IS 'Poderes otorgados entre propietarios para votar en asambleas';
COMMENT ON COLUMN poderes.estado IS 'activo: válido para usar | revocado: cancelado | usado: ya se utilizó';
COMMENT ON COLUMN poderes.archivo_poder IS 'Documento escaneado del poder (opcional)';

-- Deshabilitar RLS
ALTER TABLE poderes DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- TABLA: votos (CREAR DESPUÉS)
-- =====================================================
-- Registra cada voto emitido en las preguntas
CREATE TABLE IF NOT EXISTS votos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pregunta_id UUID REFERENCES preguntas(id) ON DELETE CASCADE NOT NULL,
  unidad_id UUID REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  opcion_id UUID REFERENCES opciones_pregunta(id) ON DELETE CASCADE NOT NULL,
  votante_email TEXT NOT NULL, -- Email de quien votó
  votante_nombre TEXT, -- Nombre de quien votó
  es_poder BOOLEAN DEFAULT false, -- ¿Votó con un poder?
  poder_id UUID REFERENCES poderes(id), -- Referencia al poder si aplica
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  
  -- Constraint: Una unidad solo puede votar una vez por pregunta
  UNIQUE(pregunta_id, unidad_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_votos_pregunta ON votos(pregunta_id);
CREATE INDEX IF NOT EXISTS idx_votos_unidad ON votos(unidad_id);
CREATE INDEX IF NOT EXISTS idx_votos_opcion ON votos(opcion_id);
CREATE INDEX IF NOT EXISTS idx_votos_email ON votos(votante_email);

COMMENT ON TABLE votos IS 'Registro de todos los votos emitidos en asambleas';
COMMENT ON COLUMN votos.es_poder IS 'true si el voto fue emitido usando un poder';
COMMENT ON COLUMN votos.poder_id IS 'Referencia al poder utilizado para votar';

-- Deshabilitar RLS
ALTER TABLE votos DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- TABLA: quorum_asamblea
-- =====================================================
-- Registra las unidades presentes en la asamblea
-- (física o virtualmente)
CREATE TABLE IF NOT EXISTS quorum_asamblea (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asamblea_id UUID REFERENCES asambleas(id) ON DELETE CASCADE NOT NULL,
  unidad_id UUID REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  email_propietario TEXT NOT NULL,
  nombre_propietario TEXT,
  presente_fisica BOOLEAN DEFAULT false,
  presente_virtual BOOLEAN DEFAULT false,
  hora_llegada TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  
  -- Constraint: Una unidad solo puede registrarse una vez por asamblea
  UNIQUE(asamblea_id, unidad_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_quorum_asamblea ON quorum_asamblea(asamblea_id);

COMMENT ON TABLE quorum_asamblea IS 'Registro de asistencia (física o virtual) a asambleas';
COMMENT ON COLUMN quorum_asamblea.presente_fisica IS 'Asiste presencialmente';
COMMENT ON COLUMN quorum_asamblea.presente_virtual IS 'Asiste virtualmente';

-- Deshabilitar RLS
ALTER TABLE quorum_asamblea DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCIÓN: Calcular estadísticas de pregunta
-- =====================================================
CREATE OR REPLACE FUNCTION calcular_estadisticas_pregunta(p_pregunta_id UUID)
RETURNS TABLE (
  opcion_id UUID,
  texto_opcion TEXT,
  color TEXT,
  votos_count INTEGER,
  votos_coeficiente NUMERIC(12, 6),
  porcentaje_nominal NUMERIC(5, 2),
  porcentaje_coeficiente NUMERIC(5, 2)
) AS $$
DECLARE
  v_total_votos INTEGER;
  v_total_coeficiente NUMERIC(12, 6);
  v_tipo_votacion TEXT;
BEGIN
  -- Obtener tipo de votación
  SELECT tipo_votacion INTO v_tipo_votacion
  FROM preguntas
  WHERE id = p_pregunta_id;

  -- Contar total de votos
  SELECT COUNT(*) INTO v_total_votos
  FROM votos
  WHERE pregunta_id = p_pregunta_id;

  -- Sumar total de coeficientes
  SELECT COALESCE(SUM(u.coeficiente), 0) INTO v_total_coeficiente
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id
  WHERE v.pregunta_id = p_pregunta_id;

  -- Calcular estadísticas por opción
  RETURN QUERY
  SELECT 
    op.id AS opcion_id,
    op.texto_opcion,
    op.color,
    COUNT(v.id)::INTEGER AS votos_count,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6) AS votos_coeficiente,
    CASE 
      WHEN v_total_votos > 0 THEN 
        ROUND((COUNT(v.id)::NUMERIC / v_total_votos::NUMERIC * 100), 2)
      ELSE 0
    END AS porcentaje_nominal,
    CASE 
      WHEN v_total_coeficiente > 0 THEN 
        ROUND((COALESCE(SUM(u.coeficiente), 0) / v_total_coeficiente * 100)::NUMERIC, 2)
      ELSE 0
    END AS porcentaje_coeficiente
  FROM opciones_pregunta op
  LEFT JOIN votos v ON op.id = v.opcion_id AND v.pregunta_id = p_pregunta_id
  LEFT JOIN unidades u ON v.unidad_id = u.id
  WHERE op.pregunta_id = p_pregunta_id
  GROUP BY op.id, op.texto_opcion, op.color, op.orden
  ORDER BY op.orden;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_estadisticas_pregunta IS 'Calcula estadísticas en tiempo real de una pregunta';

-- =====================================================
-- FUNCIÓN: Calcular quórum de asamblea
-- =====================================================
CREATE OR REPLACE FUNCTION calcular_quorum_asamblea(p_asamblea_id UUID)
RETURNS TABLE (
  total_unidades INTEGER,
  unidades_votantes INTEGER,
  unidades_pendientes INTEGER,
  coeficiente_total NUMERIC(12, 6),
  coeficiente_votante NUMERIC(12, 6),
  coeficiente_pendiente NUMERIC(12, 6),
  porcentaje_participacion_nominal NUMERIC(5, 2),
  porcentaje_participacion_coeficiente NUMERIC(5, 2),
  quorum_alcanzado BOOLEAN
) AS $$
DECLARE
  v_organization_id UUID;
BEGIN
  -- Obtener el organization_id de la asamblea
  SELECT a.organization_id INTO v_organization_id
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  -- Calcular métricas de quórum
  RETURN QUERY
  WITH unidades_conjunto AS (
    SELECT 
      COUNT(*)::INTEGER AS total,
      COALESCE(SUM(coeficiente), 0) AS coef_total
    FROM unidades
    WHERE organization_id = v_organization_id
  ),
  unidades_votantes_data AS (
    SELECT 
      COUNT(DISTINCT v.unidad_id)::INTEGER AS votantes,
      COALESCE(SUM(DISTINCT u.coeficiente), 0) AS coef_votante
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id
    JOIN preguntas p ON v.pregunta_id = p.id
    WHERE p.asamblea_id = p_asamblea_id
  )
  SELECT 
    uc.total AS total_unidades,
    COALESCE(uv.votantes, 0) AS unidades_votantes,
    (uc.total - COALESCE(uv.votantes, 0)) AS unidades_pendientes,
    uc.coef_total AS coeficiente_total,
    COALESCE(uv.coef_votante, 0) AS coeficiente_votante,
    (uc.coef_total - COALESCE(uv.coef_votante, 0)) AS coeficiente_pendiente,
    CASE 
      WHEN uc.total > 0 THEN 
        ROUND((COALESCE(uv.votantes, 0)::NUMERIC / uc.total::NUMERIC * 100), 2)
      ELSE 0
    END AS porcentaje_participacion_nominal,
    CASE 
      WHEN uc.coef_total > 0 THEN 
        ROUND((COALESCE(uv.coef_votante, 0) / uc.coef_total * 100)::NUMERIC, 2)
      ELSE 0
    END AS porcentaje_participacion_coeficiente,
    CASE 
      WHEN uc.coef_total > 0 THEN 
        (COALESCE(uv.coef_votante, 0) / uc.coef_total * 100) >= 50
      ELSE false
    END AS quorum_alcanzado
  FROM unidades_conjunto uc
  LEFT JOIN unidades_votantes_data uv ON true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_quorum_asamblea IS 'Calcula el quórum en tiempo real de una asamblea (Ley 675: 50% del coeficiente)';

-- =====================================================
-- FUNCIÓN: Verificar si una unidad puede votar
-- =====================================================
CREATE OR REPLACE FUNCTION puede_votar(
  p_pregunta_id UUID,
  p_unidad_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_ya_voto BOOLEAN;
  v_estado_pregunta TEXT;
BEGIN
  -- Verificar si la pregunta está abierta
  SELECT estado INTO v_estado_pregunta
  FROM preguntas
  WHERE id = p_pregunta_id;
  
  IF v_estado_pregunta != 'abierta' THEN
    RETURN false;
  END IF;
  
  -- Verificar si ya votó
  SELECT EXISTS(
    SELECT 1 FROM votos
    WHERE pregunta_id = p_pregunta_id
      AND unidad_id = p_unidad_id
  ) INTO v_ya_voto;
  
  RETURN NOT v_ya_voto;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION puede_votar IS 'Verifica si una unidad puede votar en una pregunta';
