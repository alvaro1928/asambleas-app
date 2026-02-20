-- =====================================================
-- Configuración SMTP editable desde Super Admin.
-- Solo accesible con service_role (no hay política SELECT para anon/auth).
-- Se usa para envío de enlace de votación por correo (alternativa a variables de entorno).
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracion_smtp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL DEFAULT 'default',
  host TEXT,
  port INTEGER NOT NULL DEFAULT 465,
  secure BOOLEAN NOT NULL DEFAULT true,
  "user" TEXT,
  pass TEXT,
  from_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

COMMENT ON TABLE configuracion_smtp IS 'Configuración SMTP para envío de correo (enlace de votación). Editable solo por Super Admin. Solo service_role puede leer/escribir.';
COMMENT ON COLUMN configuracion_smtp.host IS 'Servidor SMTP (ej. smtp.hostinger.com)';
COMMENT ON COLUMN configuracion_smtp.port IS 'Puerto (465 SSL, 587 TLS)';
COMMENT ON COLUMN configuracion_smtp.secure IS 'true para SSL (puerto 465)';
COMMENT ON COLUMN configuracion_smtp."user" IS 'Usuario/correo SMTP';
COMMENT ON COLUMN configuracion_smtp.pass IS 'Contraseña del correo (almacenada en BD; solo backend la usa)';
COMMENT ON COLUMN configuracion_smtp.from_address IS 'Remitente mostrado (ej. Votaciones <contactanos@epbco.cloud>)';

-- Una sola fila; el backend hace SELECT ... LIMIT 1
INSERT INTO configuracion_smtp (key, host, port, secure, "user", pass, from_address)
VALUES ('default', NULL, 465, true, NULL, NULL, NULL)
ON CONFLICT (key) DO NOTHING;

-- RLS: sin políticas para anon/authenticated → nadie puede leer/escribir por RLS.
-- El backend usa SUPABASE_SERVICE_ROLE_KEY y bypasea RLS, así que solo las APIs de super-admin pueden leer/actualizar.
ALTER TABLE configuracion_smtp ENABLE ROW LEVEL SECURITY;

-- Denegar todo a roles que no sean service_role (anon y authenticated no tienen política que permita nada)
DROP POLICY IF EXISTS "configuracion_smtp_service_only" ON configuracion_smtp;
CREATE POLICY "configuracion_smtp_service_only"
  ON configuracion_smtp FOR ALL
  USING (false)
  WITH CHECK (false);
