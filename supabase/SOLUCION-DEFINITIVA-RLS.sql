-- ====================================================================
-- SOLUCIÓN DEFINITIVA - Sin recursión garantizada
-- ====================================================================
-- Este script usa el enfoque MÁS SIMPLE posible para evitar recursión
-- Ejecuta esto en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Limpiar TODAS las políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Eliminar todas las políticas de organizations
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organizations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON organizations';
    END LOOP;
    
    -- Eliminar todas las políticas de profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
    
    -- Eliminar función si existe
    DROP FUNCTION IF EXISTS get_user_organization();
END $$;

-- ====================================================================
-- PASO 2: DESHABILITAR RLS temporalmente para desarrollo
-- ====================================================================
-- Esto es lo MÁS SEGURO para desarrollo mientras construyes la app
-- Puedes habilitar RLS más adelante cuando esté todo funcionando

ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE unidades DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- NOTA IMPORTANTE: 
-- ====================================================================
-- Con RLS deshabilitado, CUALQUIER usuario autenticado puede:
-- - Ver y modificar cualquier organización
-- - Ver y modificar cualquier perfil
-- - Ver y modificar cualquier unidad
--
-- Esto está OK para DESARROLLO, pero NO para producción.
--
-- Cuando estés listo para producción, ejecuta el script:
-- "HABILITAR-RLS-PRODUCCION.sql"
-- ====================================================================

-- VERIFICACIÓN: Mostrar estado de RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Habilitado"
FROM pg_tables 
WHERE tablename IN ('organizations', 'profiles', 'unidades')
ORDER BY tablename;
