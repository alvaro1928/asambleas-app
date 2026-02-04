-- Añadir user_id a pagos_log para que "Mis pagos" muestre transacciones del usuario
-- aunque el pago se haya acreditado sin organización (ej. perfil recién creado por webhook).
-- Ejecutar en Supabase → SQL Editor.

ALTER TABLE pagos_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN pagos_log.user_id IS 'Usuario gestor que recibió el pago (para listar en Mis pagos)';

CREATE INDEX IF NOT EXISTS idx_pagos_log_user_id ON pagos_log(user_id) WHERE user_id IS NOT NULL;

-- Permitir registrar pago sin organización (cuando el webhook acredita a un usuario sin conjunto)
ALTER TABLE pagos_log ALTER COLUMN organization_id DROP NOT NULL;
