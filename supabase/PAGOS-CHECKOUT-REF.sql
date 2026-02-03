-- =====================================================
-- Referencias de checkout (link de pago Wompi creado por API)
-- Cuando el backend crea un payment link con sku = short_ref,
-- guardamos short_ref -> user_id para que el webhook acredite al usuario.
-- =====================================================

CREATE TABLE IF NOT EXISTS pagos_checkout_ref (
  ref TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  amount_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

COMMENT ON TABLE pagos_checkout_ref IS 'Mapeo ref (sku del link Wompi) -> user_id para acreditar tokens en el webhook';
CREATE INDEX IF NOT EXISTS idx_pagos_checkout_ref_created_at ON pagos_checkout_ref(created_at);

ALTER TABLE pagos_checkout_ref ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagos_checkout_ref_service_only" ON pagos_checkout_ref;
CREATE POLICY "pagos_checkout_ref_service_only"
  ON pagos_checkout_ref FOR ALL
  USING (false)
  WITH CHECK (false);

-- El backend usa service_role, que bypassa RLS. No exponemos esta tabla al anon.
