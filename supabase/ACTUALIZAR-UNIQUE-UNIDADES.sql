-- ====================================================================
-- ACTUALIZAR CONSTRAINT UNIQUE EN UNIDADES
-- ====================================================================
-- Permite números repetidos si están en diferentes torres
-- Ejemplo: Torre A - 101 y Torre B - 101 son DIFERENTES
-- ====================================================================

-- PASO 1: Eliminar el constraint antiguo (solo organization_id, numero)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unidades_organization_id_numero_key'
    ) THEN
        ALTER TABLE unidades DROP CONSTRAINT unidades_organization_id_numero_key;
    END IF;
END $$;

-- PASO 2: Crear nuevo constraint UNIQUE con torre incluida
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_unidad_torre_numero'
    ) THEN
        ALTER TABLE unidades 
        ADD CONSTRAINT unique_unidad_torre_numero 
        UNIQUE (organization_id, torre, numero);
    END IF;
END $$;

-- ====================================================================
-- VERIFICACIÓN
-- ====================================================================
SELECT
    conname as "Constraint",
    pg_get_constraintdef(oid) as "Definición"
FROM pg_constraint
WHERE conrelid = 'unidades'::regclass
  AND contype = 'u'
ORDER BY conname;

-- Verificar columnas de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'unidades'
ORDER BY ordinal_position;
