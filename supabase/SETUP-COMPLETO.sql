-- ====================================================================
-- SETUP COMPLETO - Crear tablas y deshabilitar RLS
-- ====================================================================
-- Este script hace TODO en el orden correcto
-- Ejecuta esto en Supabase SQL Editor
-- ====================================================================

-- PASO 1: Deshabilitar RLS en las tablas que SÍ existen
ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;

-- PASO 2: Crear la tabla unidades (si no existe)
CREATE TABLE IF NOT EXISTS unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  numero TEXT NOT NULL,
  coeficiente DECIMAL(10, 6) NOT NULL,
  tipo TEXT DEFAULT 'apartamento' CHECK (tipo IN ('apartamento', 'casa', 'local', 'parqueadero', 'bodega')),
  propietario TEXT,
  email_propietario TEXT,
  telefono_propietario TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(organization_id, numero)
);

-- PASO 3: Crear índice para unidades (si no existe)
CREATE INDEX IF NOT EXISTS idx_unidades_organization_id ON unidades(organization_id);

-- PASO 4: Crear función para updated_at (si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASO 5: Crear trigger para unidades (si no existe)
DROP TRIGGER IF EXISTS update_unidades_updated_at ON unidades;
CREATE TRIGGER update_unidades_updated_at
  BEFORE UPDATE ON unidades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- PASO 6: Deshabilitar RLS en unidades
ALTER TABLE unidades DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- VERIFICACIÓN: Mostrar estado de todas las tablas
-- ====================================================================
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity = true THEN '❌ RLS HABILITADO'
        WHEN rowsecurity = false THEN '✅ RLS DESHABILITADO'
    END as estado_rls
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'profiles', 'unidades')
ORDER BY tablename;

-- ====================================================================
-- Deberías ver las 3 tablas con "✅ RLS DESHABILITADO"
-- ====================================================================
