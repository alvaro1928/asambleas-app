-- =====================================================
-- Pagos autónomos: plan_status, subscription_id,
-- last_payment_date en organizations + tabla pagos_historial
-- =====================================================
-- Migración segura: ADD COLUMN IF NOT EXISTS.
-- Ejecutar en Supabase SQL Editor.
-- =====================================================

-- plan_status: 'active' | 'inactive' (estado de la suscripción de pago)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'inactive';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_plan_status_check'
      AND conrelid = 'organizations'::regclass
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_plan_status_check
      CHECK (plan_status IN ('active', 'inactive'));
  END IF;
END $$;

-- subscription_id: ID de la suscripción en el proveedor de pagos (Stripe, etc.)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_id TEXT DEFAULT NULL;

-- last_payment_date: fecha del último pago confirmado
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN organizations.plan_status IS 'Estado de la suscripción de pago: active o inactive';
COMMENT ON COLUMN organizations.subscription_id IS 'ID de la suscripción en el proveedor de pagos';
COMMENT ON COLUMN organizations.last_payment_date IS 'Fecha y hora del último pago confirmado';

-- =====================================================
-- Tabla pagos_historial: una fila por transacción confirmada
-- =====================================================

CREATE TABLE IF NOT EXISTS pagos_historial (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  external_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  description TEXT,
  plan_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

COMMENT ON TABLE pagos_historial IS 'Historial de transacciones de pago confirmadas por conjunto';
COMMENT ON COLUMN pagos_historial.amount_cents IS 'Monto en centavos (ej. 50000 = 500.00 COP)';
COMMENT ON COLUMN pagos_historial.external_payment_id IS 'ID de la transacción en el proveedor de pagos';
COMMENT ON COLUMN pagos_historial.plan_type IS 'Plan asociado al pago: free, pro, pilot';

CREATE INDEX IF NOT EXISTS idx_pagos_historial_organization_id ON pagos_historial(organization_id);
CREATE INDEX IF NOT EXISTS idx_pagos_historial_created_at ON pagos_historial(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_historial_external_id ON pagos_historial(external_payment_id) WHERE external_payment_id IS NOT NULL;
