-- =====================================================
-- Configuración WhatsApp (Meta API) y cobro en tokens por mensaje.
-- Meta cobra por mensaje tipo marketing: ~USD 0.025 – 0.14 según país (ej. Colombia en rango bajo).
-- tokens_por_mensaje_whatsapp: cuántos tokens se descuentan por cada mensaje enviado.
-- Fijar este valor para que (tokens_por_mensaje_whatsapp × precio_por_token_cop) sea un poco
-- mayor que el costo en COP de Meta, así no se pierde dinero.
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracion_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL DEFAULT 'default',
  access_token TEXT,
  phone_number_id TEXT,
  template_name TEXT,
  tokens_por_mensaje_whatsapp INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

COMMENT ON TABLE configuracion_whatsapp IS 'Configuración WhatsApp Business API (Meta). Token, Phone Number ID, plantilla y tokens a descontar por mensaje.';
COMMENT ON COLUMN configuracion_whatsapp.access_token IS 'Token de acceso de Meta (Graph API).';
COMMENT ON COLUMN configuracion_whatsapp.phone_number_id IS 'Phone Number ID del número de WhatsApp Business.';
COMMENT ON COLUMN configuracion_whatsapp.template_name IS 'Nombre de la plantilla aprobada por Meta (ej. notificacion_votacion).';
COMMENT ON COLUMN configuracion_whatsapp.tokens_por_mensaje_whatsapp IS 'Tokens que se descuentan por cada mensaje WhatsApp enviado. Meta cobra ~USD 0.025-0.14 por mensaje marketing; fijar este valor para que (tokens_por_mensaje × precio_por_token_cop) cubra ese costo y un margen.';

INSERT INTO configuracion_whatsapp (key, tokens_por_mensaje_whatsapp)
VALUES ('default', 1)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE configuracion_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracion_whatsapp_service_only" ON configuracion_whatsapp;
CREATE POLICY "configuracion_whatsapp_service_only"
  ON configuracion_whatsapp FOR ALL
  USING (false)
  WITH CHECK (false);

-- Permitir tipo_operacion 'WhatsApp' en billing_logs
ALTER TABLE billing_logs DROP CONSTRAINT IF EXISTS billing_logs_tipo_operacion_check;
ALTER TABLE billing_logs ADD CONSTRAINT billing_logs_tipo_operacion_check
  CHECK (tipo_operacion IN ('Acta', 'Votación', 'Registro_manual', 'Compra', 'Ajuste_manual', 'WhatsApp'));

COMMENT ON COLUMN billing_logs.tipo_operacion IS 'Acta = descarga acta; Votación = activar votación; Registro_manual = voto por admin; Compra = pago; Ajuste_manual = Super Admin; WhatsApp = envío masivo por WhatsApp (marketing).';
