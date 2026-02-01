-- =====================================================
-- Tabla configuracion_global: título, subtítulo y WhatsApp
-- de la Landing Page (editable desde Super Admin).
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracion_global (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL DEFAULT 'landing',
  titulo TEXT,
  subtitulo TEXT,
  whatsapp_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

COMMENT ON TABLE configuracion_global IS 'Configuración global (landing: título, subtítulo, WhatsApp) editable desde Super Admin';
COMMENT ON COLUMN configuracion_global.key IS 'Identificador del bloque de config (ej. landing)';
COMMENT ON COLUMN configuracion_global.titulo IS 'Título principal de la landing (hero)';
COMMENT ON COLUMN configuracion_global.subtitulo IS 'Subtítulo de la landing (hero)';
COMMENT ON COLUMN configuracion_global.whatsapp_number IS 'Número WhatsApp para contacto (código país, ej. 573001234567)';

-- Una sola fila para la landing
INSERT INTO configuracion_global (key, titulo, subtitulo, whatsapp_number)
VALUES (
  'landing',
  'Asambleas digitales para propiedad horizontal',
  'Votaciones en tiempo real, actas y auditoría. Pensado para administradores y consejos de administración.',
  NULL
)
ON CONFLICT (key) DO NOTHING;

-- RLS: lectura pública para GET /api/configuracion-global; escritura solo con service_role (super-admin)
ALTER TABLE configuracion_global ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracion_global_read_public" ON configuracion_global;
CREATE POLICY "configuracion_global_read_public"
  ON configuracion_global FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "configuracion_global_write_service_only" ON configuracion_global;
CREATE POLICY "configuracion_global_write_service_only"
  ON configuracion_global FOR ALL
  USING (false)
  WITH CHECK (false);
