-- Migración: Agregar campos a organizations y crear tabla unidades
-- Ejecuta este script si ya ejecutaste el schema.sql inicial

-- Agregar campos a la tabla organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS nit TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Crear tabla unidades
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

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_unidades_organization_id ON unidades(organization_id);

-- Crear trigger para updated_at
DROP TRIGGER IF EXISTS update_unidades_updated_at ON unidades;
CREATE TRIGGER update_unidades_updated_at
  BEFORE UPDATE ON unidades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para unidades
DROP POLICY IF EXISTS "Users can view unidades in their organization" ON unidades;
CREATE POLICY "Users can view unidades in their organization"
  ON unidades FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and owners can create unidades" ON unidades;
CREATE POLICY "Admins and owners can create unidades"
  ON unidades FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins and owners can update unidades" ON unidades;
CREATE POLICY "Admins and owners can update unidades"
  ON unidades FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners can delete unidades" ON unidades;
CREATE POLICY "Owners can delete unidades"
  ON unidades FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role = 'owner'
    )
  );
