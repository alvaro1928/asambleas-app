-- ====================================================================
-- AGREGAR COLUMNA TORRE/BLOQUE A UNIDADES
-- ====================================================================
-- Permite organizar unidades por torres o bloques
-- ====================================================================

-- Agregar columna torre/bloque si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unidades' 
        AND column_name = 'torre'
    ) THEN
        ALTER TABLE unidades ADD COLUMN torre TEXT;
    END IF;
END $$;

-- Verificación
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'unidades'
ORDER BY ordinal_position;
