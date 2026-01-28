-- ====================================================================
-- LIMPIAR DUPLICADOS Y AGREGAR CONSTRAINTS UNIQUE
-- ====================================================================
-- Este script limpia duplicados y luego agrega constraints
-- Ejecuta este script en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Ver qué NITs están duplicados
SELECT 
    nit,
    COUNT(*) as cantidad,
    STRING_AGG(name, ', ') as conjuntos
FROM organizations
WHERE nit IS NOT NULL
GROUP BY nit
HAVING COUNT(*) > 1;

-- PASO 2: Ver qué emails están duplicados
SELECT 
    email,
    COUNT(*) as cantidad
FROM profiles
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- ====================================================================
-- PASO 3: ELIMINAR DUPLICADOS (mantener solo el más reciente)
-- ====================================================================

-- Eliminar conjuntos duplicados (mantener el más nuevo)
DELETE FROM organizations
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY nit ORDER BY created_at DESC) as rn
        FROM organizations
        WHERE nit IS NOT NULL
    ) t
    WHERE rn > 1
);

-- Eliminar perfiles duplicados (mantener el más nuevo)
DELETE FROM profiles
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
        FROM profiles
        WHERE email IS NOT NULL
    ) t
    WHERE rn > 1
);

-- ====================================================================
-- PASO 4: AGREGAR CONSTRAINTS UNIQUE
-- ====================================================================

-- Agregar constraint UNIQUE al NIT
ALTER TABLE organizations 
ADD CONSTRAINT unique_organization_nit UNIQUE (nit);

-- Agregar constraint UNIQUE al email
ALTER TABLE profiles 
ADD CONSTRAINT unique_profile_email UNIQUE (email);

-- ====================================================================
-- VERIFICACIÓN FINAL
-- ====================================================================
SELECT
    conname as "Constraint",
    conrelid::regclass as "Tabla",
    pg_get_constraintdef(oid) as "Definición"
FROM pg_constraint
WHERE conname IN ('unique_organization_nit', 'unique_profile_email')
ORDER BY conrelid::regclass;

-- ====================================================================
-- Mostrar resumen de la limpieza
-- ====================================================================
SELECT 
    'organizations' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT nit) as nits_unicos
FROM organizations
UNION ALL
SELECT 
    'profiles' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT email) as emails_unicos
FROM profiles;
