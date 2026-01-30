-- =====================================================
-- Integración Wompi: columnas en organizations (conjuntos)
-- y tabla pagos_log
-- =====================================================
-- Ejecutar en Supabase SQL Editor.
-- El webhook usa SUPABASE_SERVICE_ROLE_KEY, que bypasea RLS.
-- =====================================================

-- 1. Columnas en organizations (conjuntos)
-- plan_type y plan_active_until ya pueden existir por migraciones anteriores

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_plan_type_check'
      AND conrelid = 'organizations'::regclass
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_plan_type_check
      CHECK (plan_type IN ('free', 'pro', 'pilot'));
  END IF;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_subscription_status_check'
      AND conrelid = 'organizations'::regclass
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_subscription_status_check
      CHECK (subscription_status IN ('active', 'inactive', 'pending', 'cancelled'));
  END IF;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS wompi_reference TEXT DEFAULT NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_active_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN organizations.plan_type IS 'Plan: free, pro, pilot';
COMMENT ON COLUMN organizations.subscription_status IS 'Estado de suscripción Wompi: active, inactive, pending, cancelled';
COMMENT ON COLUMN organizations.wompi_reference IS 'Referencia única enviada a Wompi (ej. REF_uuid_timestamp)';
COMMENT ON COLUMN organizations.plan_active_until IS 'Fecha hasta la que el plan está activo';

-- 2. Tabla pagos_log (log por transacción Wompi)
CREATE TABLE IF NOT EXISTS pagos_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monto BIGINT NOT NULL,
  wompi_transaction_id TEXT,
  estado TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

COMMENT ON TABLE pagos_log IS 'Log de transacciones Wompi por conjunto';
COMMENT ON COLUMN pagos_log.organization_id IS 'Conjunto (organizations.id)';
COMMENT ON COLUMN pagos_log.monto IS 'Monto en centavos (ej. 20000000 = 200.000 COP)';
COMMENT ON COLUMN pagos_log.wompi_transaction_id IS 'ID de la transacción en Wompi';
COMMENT ON COLUMN pagos_log.estado IS 'Estado Wompi: APPROVED, PENDING, DECLINED, etc.';

CREATE INDEX IF NOT EXISTS idx_pagos_log_organization_id ON pagos_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_pagos_log_wompi_transaction_id ON pagos_log(wompi_transaction_id) WHERE wompi_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_log_created_at ON pagos_log(created_at DESC);

-- 3. RLS: solo el backend (service_role) debe escribir en pagos_log
-- En Supabase, las peticiones con service_role BYPASEAN RLS, así que el webhook
-- puede INSERT/UPDATE sin políticas. Activamos RLS para que usuarios normales
-- (anon/authenticated) no accedan por cliente.
ALTER TABLE pagos_log ENABLE ROW LEVEL SECURITY;

-- Sin políticas para authenticated/anon: solo service_role (webhook) puede acceder.
-- service_role siempre bypasea RLS, por lo que el webhook sigue funcionando.
DROP POLICY IF EXISTS "pagos_log_no_direct_client" ON pagos_log;
CREATE POLICY "pagos_log_no_direct_client"
  ON pagos_log FOR ALL
  USING (false)
  WITH CHECK (false);
