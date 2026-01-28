-- ====================================================================
-- AGREGAR CONSTRAINTS UNIQUE para evitar duplicados
-- ====================================================================
-- Ejecuta este script en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Agregar constraint UNIQUE al NIT en organizations
-- Esto evitará que se registren dos conjuntos con el mismo NIT
ALTER TABLE organizations 
ADD CONSTRAINT unique_organization_nit UNIQUE (nit);

-- PASO 2: Agregar constraint UNIQUE al email en profiles
-- Esto evitará que se registren dos usuarios con el mismo email
ALTER TABLE profiles 
ADD CONSTRAINT unique_profile_email UNIQUE (email);

-- ====================================================================
-- VERIFICACIÓN: Mostrar los constraints creados
-- ====================================================================
SELECT
    conname as "Constraint",
    conrelid::regclass as "Tabla",
    pg_get_constraintdef(oid) as "Definición"
FROM pg_constraint
WHERE conname IN ('unique_organization_nit', 'unique_profile_email')
ORDER BY conrelid::regclass;

-- ====================================================================
-- Resultado esperado:
-- - unique_organization_nit | organizations | UNIQUE (nit)
-- - unique_profile_email    | profiles      | UNIQUE (email)
-- ====================================================================
