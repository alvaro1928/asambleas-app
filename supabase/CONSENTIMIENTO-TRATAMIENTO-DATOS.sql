-- Tabla para registrar la aceptación del tratamiento de datos personales (LOPD / Ley 1581)
-- por parte de los votantes al acceder a una asamblea. Una aceptación por asamblea + identificador.

CREATE TABLE IF NOT EXISTS consentimiento_tratamiento_datos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  identificador TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  UNIQUE(asamblea_id, identificador)
);

COMMENT ON TABLE consentimiento_tratamiento_datos IS 'Aceptación del tratamiento de datos personales por votante y asamblea (Ley 1581 de 2012, LOPD)';
COMMENT ON COLUMN consentimiento_tratamiento_datos.identificador IS 'Email o teléfono del votante (normalizado)';
COMMENT ON COLUMN consentimiento_tratamiento_datos.accepted_at IS 'Fecha y hora de la aceptación';
COMMENT ON COLUMN consentimiento_tratamiento_datos.ip_address IS 'IP desde la que se aceptó (opcional, trazabilidad)';

-- RLS: acceso solo vía API (service role). Sin políticas para anon/authenticated, solo el backend puede leer/escribir.
ALTER TABLE consentimiento_tratamiento_datos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_consentimiento_asamblea_identificador
  ON consentimiento_tratamiento_datos(asamblea_id, identificador);
