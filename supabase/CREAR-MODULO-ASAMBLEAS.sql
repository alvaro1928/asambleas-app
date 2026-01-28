-- =====================================================
-- MÓDULO DE ASAMBLEAS Y VOTACIONES
-- =====================================================
-- Este script crea las tablas necesarias para el sistema
-- de asambleas y votaciones de la plataforma
-- =====================================================

-- TABLA: asambleas
-- Almacena las asambleas programadas por cada conjunto
CREATE TABLE IF NOT EXISTS asambleas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha TIMESTAMP WITH TIME ZONE NOT NULL,
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'activa', 'finalizada')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índice para mejorar búsquedas por organización
CREATE INDEX IF NOT EXISTS idx_asambleas_organization 
ON asambleas(organization_id);

-- Índice para mejorar búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_asambleas_estado 
ON asambleas(estado);

-- =====================================================

-- TABLA: preguntas
-- Almacena las preguntas de votación de cada asamblea
CREATE TABLE IF NOT EXISTS preguntas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asamblea_id UUID REFERENCES asambleas(id) ON DELETE CASCADE NOT NULL,
  orden INTEGER DEFAULT 1,
  texto_pregunta TEXT NOT NULL,
  descripcion TEXT,
  tipo_votacion TEXT DEFAULT 'coeficiente' CHECK (tipo_votacion IN ('coeficiente', 'nominal')) NOT NULL,
  resultado_json JSONB DEFAULT '{}'::jsonb,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'abierta', 'cerrada')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índice para mejorar búsquedas por asamblea
CREATE INDEX IF NOT EXISTS idx_preguntas_asamblea 
ON preguntas(asamblea_id);

-- Índice para mejorar ordenamiento
CREATE INDEX IF NOT EXISTS idx_preguntas_orden 
ON preguntas(orden);

-- =====================================================

-- COMENTARIOS EXPLICATIVOS
COMMENT ON TABLE asambleas IS 'Almacena las asambleas de copropietarios';
COMMENT ON COLUMN asambleas.estado IS 'borrador: en preparación | activa: en curso | finalizada: terminada';

COMMENT ON TABLE preguntas IS 'Preguntas de votación para cada asamblea';
COMMENT ON COLUMN preguntas.tipo_votacion IS 'coeficiente: voto ponderado por coeficiente | nominal: un voto por unidad';
COMMENT ON COLUMN preguntas.resultado_json IS 'Estructura: {"a_favor": 0, "en_contra": 0, "abstenciones": 0, "votos": []}';
COMMENT ON COLUMN preguntas.estado IS 'pendiente: no iniciada | abierta: votación activa | cerrada: terminada';

-- =====================================================
-- DESHABILITAR RLS (Para desarrollo)
-- =====================================================
ALTER TABLE asambleas DISABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que las tablas se crearon correctamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('asambleas', 'preguntas')
ORDER BY table_name, ordinal_position;
