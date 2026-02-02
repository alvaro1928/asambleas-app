-- =====================================================
-- BILLING_LOGS: auditoría de cobro (tokens)
-- Registra cada operación que consume tokens: Acta, Votación, Registro manual, Compra.
-- =====================================================

CREATE TABLE IF NOT EXISTS billing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  tipo_operacion TEXT NOT NULL CHECK (tipo_operacion IN ('Acta', 'Votación', 'Registro_manual', 'Compra', 'Ajuste_manual')),
  asamblea_id UUID,
  organization_id UUID,
  tokens_usados INTEGER NOT NULL DEFAULT 0,
  saldo_restante INTEGER NOT NULL DEFAULT 0,
  metadata JSONB
);

COMMENT ON TABLE billing_logs IS 'Auditoría de cobro: cada descuento o acreditación de tokens del gestor';
COMMENT ON COLUMN billing_logs.tipo_operacion IS 'Acta = descarga acta; Votación = activar votación; Registro_manual = voto registrado por admin; Compra = pago; Ajuste_manual = Super Admin';
CREATE INDEX IF NOT EXISTS idx_billing_logs_user_id ON billing_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_fecha ON billing_logs(fecha DESC);
