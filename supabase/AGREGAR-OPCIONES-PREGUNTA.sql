-- =====================================================
-- TABLA DE OPCIONES PARA PREGUNTAS
-- =====================================================
-- Permite configurar opciones de respuesta personalizadas
-- para cada pregunta de votación
-- =====================================================

CREATE TABLE IF NOT EXISTS opciones_pregunta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pregunta_id UUID REFERENCES preguntas(id) ON DELETE CASCADE NOT NULL,
  texto_opcion TEXT NOT NULL,
  orden INTEGER DEFAULT 1,
  color TEXT DEFAULT '#6366f1', -- Color para visualización (hex)
  votos_count INTEGER DEFAULT 0, -- Contador de votos (se actualiza con triggers)
  votos_coeficiente NUMERIC(12, 6) DEFAULT 0, -- Suma de coeficientes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índice para búsquedas rápidas por pregunta
CREATE INDEX IF NOT EXISTS idx_opciones_pregunta 
ON opciones_pregunta(pregunta_id);

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON TABLE opciones_pregunta IS 'Opciones de respuesta para cada pregunta de votación';
COMMENT ON COLUMN opciones_pregunta.texto_opcion IS 'Texto de la opción (Ej: A favor, En contra, Me abstengo)';
COMMENT ON COLUMN opciones_pregunta.votos_count IS 'Número de votos recibidos (nominal)';
COMMENT ON COLUMN opciones_pregunta.votos_coeficiente IS 'Suma de coeficientes de los votos (ponderado)';

-- =====================================================
-- DESHABILITAR RLS (Para desarrollo)
-- =====================================================
ALTER TABLE opciones_pregunta DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCIÓN AUXILIAR: Crear opciones por defecto
-- =====================================================
-- Esta función crea las opciones estándar (A favor, En contra, Abstención)
-- para preguntas que no tengan opciones personalizadas
CREATE OR REPLACE FUNCTION crear_opciones_por_defecto(p_pregunta_id UUID)
RETURNS void AS $$
BEGIN
  -- Solo crear si no existen opciones
  IF NOT EXISTS (SELECT 1 FROM opciones_pregunta WHERE pregunta_id = p_pregunta_id) THEN
    INSERT INTO opciones_pregunta (pregunta_id, texto_opcion, orden, color) VALUES
      (p_pregunta_id, 'A favor', 1, '#10b981'),
      (p_pregunta_id, 'En contra', 2, '#ef4444'),
      (p_pregunta_id, 'Me abstengo', 3, '#6b7280');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'opciones_pregunta'
ORDER BY ordinal_position;
