-- =====================================================
-- Configuración legal editable desde Super Admin
-- Documentos: Términos, EULA, Privacidad, Cookies
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracion_legal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  ultima_actualizacion TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

COMMENT ON TABLE configuracion_legal IS 'Documentos legales editables desde Super Admin';
COMMENT ON COLUMN configuracion_legal.doc_key IS 'Clave del documento legal (terminos_condiciones, eula, politica_privacidad, politica_cookies)';

-- RLS: lectura pública y escritura solo con service_role (vía API segura)
ALTER TABLE configuracion_legal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracion_legal_read_public" ON configuracion_legal;
CREATE POLICY "configuracion_legal_read_public"
  ON configuracion_legal FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "configuracion_legal_write_service_only" ON configuracion_legal;
CREATE POLICY "configuracion_legal_write_service_only"
  ON configuracion_legal FOR ALL
  USING (false)
  WITH CHECK (false);

