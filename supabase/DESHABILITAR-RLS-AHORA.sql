-- ====================================================================
-- DESHABILITAR RLS - SCRIPT ULTRA SIMPLE
-- ====================================================================
-- Ejecuta SOLO estas 3 líneas en Supabase SQL Editor
-- ====================================================================

ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE unidades DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- VERIFICAR que funcionó
-- ====================================================================
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity = true THEN '❌ HABILITADO (malo)'
        WHEN rowsecurity = false THEN '✅ DESHABILITADO (bueno)'
    END as estado
FROM pg_tables 
WHERE tablename IN ('organizations', 'profiles', 'unidades')
ORDER BY tablename;

-- ====================================================================
-- Si ves "✅ DESHABILITADO" para las 3 tablas, está listo
-- Si ves "❌ HABILITADO", hay un problema de permisos
-- ====================================================================
