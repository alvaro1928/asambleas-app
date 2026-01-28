-- ============================================
-- VERIFICAR Y CORREGIR TABLA PROFILES
-- ============================================
-- Este script verifica el estado actual de la tabla profiles
-- y corrige cualquier problema con la migración de datos.

-- Paso 1: Verificar estructura actual de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Paso 2: Verificar datos existentes
SELECT 
    id,
    user_id,
    email,
    organization_id,
    role
FROM profiles
LIMIT 10;

-- Paso 3: Contar perfiles
SELECT 
    COUNT(*) as total_profiles,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT organization_id) as unique_orgs
FROM profiles;

-- ============================================
-- CORRECCIÓN SI ES NECESARIO
-- ============================================
-- Si ves que user_id está NULL o mal, ejecuta esto:

-- Verificar si hay perfiles con user_id NULL
SELECT COUNT(*) as profiles_sin_user_id
FROM profiles
WHERE user_id IS NULL;

-- Si hay perfiles con user_id NULL, probablemente la migración no se completó
-- En ese caso, necesitamos volver a ejecutar la migración

-- ============================================
-- RE-MIGRACIÓN COMPLETA (solo si es necesario)
-- ============================================

-- IMPORTANTE: Solo ejecuta esto si la verificación mostró problemas

-- 1. Crear tabla temporal con la estructura correcta
CREATE TABLE IF NOT EXISTS profiles_temp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT,
  full_name TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, organization_id)
);

-- 2. Copiar datos existentes (asumiendo que profiles actual tiene los datos correctos)
-- Si la migración anterior falló, los datos pueden estar en un estado inconsistente
-- En ese caso, esta query intentará copiar lo que sea válido
INSERT INTO profiles_temp (user_id, email, full_name, organization_id, role, created_at, updated_at)
SELECT 
    COALESCE(user_id, id) as user_id,  -- Usar user_id si existe, sino usar id
    email,
    full_name,
    organization_id,
    role,
    created_at,
    updated_at
FROM profiles
WHERE organization_id IS NOT NULL  -- Solo copiar perfiles con organización
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- 3. Verificar cuántos registros se copiaron
SELECT 
    (SELECT COUNT(*) FROM profiles) as registros_originales,
    (SELECT COUNT(*) FROM profiles_temp) as registros_migrados;

-- 4. Si todo se ve bien, reemplazar la tabla
-- ADVERTENCIA: Esto eliminará la tabla profiles actual
-- DROP TABLE IF EXISTS profiles CASCADE;
-- ALTER TABLE profiles_temp RENAME TO profiles;

-- 5. Recrear índices y trigger
-- CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
-- CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = TIMEZONE('utc', NOW());
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
-- CREATE TRIGGER update_profiles_updated_at
--     BEFORE UPDATE ON profiles
--     FOR EACH ROW
--     EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

SELECT 
    'profiles' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT user_id) as usuarios_unicos,
    COUNT(DISTINCT organization_id) as organizaciones_unicas,
    COUNT(*) FILTER (WHERE user_id IS NULL) as user_id_null,
    COUNT(*) FILTER (WHERE organization_id IS NULL) as org_id_null
FROM profiles;

-- Ver algunos ejemplos de datos
SELECT 
    id,
    user_id,
    email,
    organization_id,
    role,
    created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;
