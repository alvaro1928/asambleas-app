-- =====================================================
-- Suscripciones: columnas de plan en organizations (conjuntos)
-- =====================================================
-- Migración segura: ADD COLUMN IF NOT EXISTS y valores por defecto
-- para no afectar datos existentes. Ejecutar en Supabase SQL Editor.
-- =====================================================

-- plan_type: 'free' | 'pro' | 'pilot'
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free';

-- Constraint solo si no existe (evita error si se re-ejecuta)
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

-- Fecha hasta la que el plan está activo (NULL = sin vencimiento o free)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_active_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Piloto: conjunto en programa piloto (acceso especial)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_pilot BOOLEAN NOT NULL DEFAULT false;

-- Comentarios
COMMENT ON COLUMN organizations.plan_type IS 'Plan de suscripción: free, pro o pilot';
COMMENT ON COLUMN organizations.plan_active_until IS 'Fecha hasta la que el plan está activo; NULL si free o sin vencimiento';
COMMENT ON COLUMN organizations.is_pilot IS 'True si el conjunto está en programa piloto';
