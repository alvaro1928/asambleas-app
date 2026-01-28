-- ====================================================================
-- ACTUALIZAR TABLA PROFILES PARA MULTI-CONJUNTO
-- ====================================================================
-- Permite que un usuario administre múltiples conjuntos
-- Ejecuta este script en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Crear nueva tabla profiles con estructura correcta
CREATE TABLE IF NOT EXISTS profiles_new (
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

-- PASO 2: Copiar datos existentes
INSERT INTO profiles_new (user_id, email, full_name, organization_id, role, created_at, updated_at)
SELECT id as user_id, email, full_name, organization_id, role, created_at, updated_at
FROM profiles
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- PASO 3: Eliminar tabla vieja y renombrar
DROP TABLE IF EXISTS profiles CASCADE;
ALTER TABLE profiles_new RENAME TO profiles;

-- PASO 4: Crear índices
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- PASO 5: Recrear trigger para updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- PASO 6: Deshabilitar RLS (para desarrollo)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- VERIFICACIÓN
-- ====================================================================
SELECT 
    'profiles' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT user_id) as usuarios_unicos,
    COUNT(DISTINCT organization_id) as organizaciones_unicas
FROM profiles;

-- Mostrar estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
