-- =====================================================
-- VERIFICAR Y COMPLETAR TABLA VOTOS
-- =====================================================

-- 1. Ver columnas actuales
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'votos'
ORDER BY ordinal_position;

-- 2. Agregar columnas faltantes si no existen
ALTER TABLE votos 
ADD COLUMN IF NOT EXISTS votante_email TEXT,
ADD COLUMN IF NOT EXISTS votante_nombre TEXT,
ADD COLUMN IF NOT EXISTS es_poder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS poder_id UUID REFERENCES poderes(id);

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_votos_email ON votos(votante_email);
CREATE INDEX IF NOT EXISTS idx_votos_pregunta_unidad ON votos(pregunta_id, unidad_id);

-- 4. Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'votos'
ORDER BY ordinal_position;
