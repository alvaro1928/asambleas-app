-- =====================================================
-- Tabla planes: administración de planes y precios
-- =====================================================
-- Ejecutar en Supabase SQL Editor.
-- La super-admin podrá editar nombre y precio desde la UI.
-- =====================================================

CREATE TABLE IF NOT EXISTS planes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  precio_cop_anual BIGINT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

COMMENT ON TABLE planes IS 'Planes (free, pro, pilot) con nombre y precio; editable desde super-admin';
COMMENT ON COLUMN planes.key IS 'Identificador: free, pro, pilot';
COMMENT ON COLUMN planes.nombre IS 'Nombre para mostrar (ej. Gratis, Pro, Piloto)';
COMMENT ON COLUMN planes.precio_cop_anual IS 'Precio en COP por año (0 = gratis)';

CREATE INDEX IF NOT EXISTS idx_planes_key ON planes(key);
CREATE INDEX IF NOT EXISTS idx_planes_activo ON planes(activo) WHERE activo = true;

-- RLS: solo service_role escribe; lectura pública para GET /api/planes
ALTER TABLE planes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planes_read_public" ON planes;
CREATE POLICY "planes_read_public"
  ON planes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "planes_write_service_only" ON planes;
CREATE POLICY "planes_write_service_only"
  ON planes FOR ALL
  USING (false)
  WITH CHECK (false);

-- Seed: free, pro, pilot (insert only if not exists)
INSERT INTO planes (key, nombre, precio_cop_anual, activo)
VALUES
  ('free', 'Gratis', 0, true),
  ('pro', 'Pro', 200000, true),
  ('pilot', 'Piloto', 200000, true)
ON CONFLICT (key) DO NOTHING;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION planes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS planes_updated_at ON planes;
CREATE TRIGGER planes_updated_at
  BEFORE UPDATE ON planes
  FOR EACH ROW EXECUTE FUNCTION planes_updated_at();
