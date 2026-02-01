-- =====================================================
-- MIGRACIÓN: Suscripción Anual por Conjunto → Billetera de Tokens por Gestor
-- 1 Token = 1 Unidad de Vivienda. Costo de operación = unidades_del_conjunto.
-- Regalo de bienvenida: 50 tokens por nuevo Gestor.
-- =====================================================

-- 1. Billetera en perfiles (tokens del Gestor)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tokens_disponibles INTEGER NOT NULL DEFAULT 50;

COMMENT ON COLUMN profiles.tokens_disponibles IS 'Billetera del Gestor: tokens disponibles. 1 token = 1 unidad. Nuevos gestores reciben 50. Se actualiza en todas las filas del mismo user_id.';

-- Regalo de bienvenida: perfiles existentes sin tokens reciben 50
UPDATE profiles
SET tokens_disponibles = 50
WHERE tokens_disponibles IS NULL OR tokens_disponibles < 0;

-- Sincronizar saldo por user_id si existe la columna
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    WITH saldo_por_usuario AS (
      SELECT user_id, MAX(tokens_disponibles) AS saldo
      FROM profiles
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    )
    UPDATE profiles p
    SET tokens_disponibles = s.saldo
    FROM saldo_por_usuario s
    WHERE p.user_id = s.user_id AND p.tokens_disponibles IS DISTINCT FROM s.saldo;
  END IF;
END $$;

-- 2. Función centralizada: costo en tokens = unidades del conjunto (1 token = 1 unidad)
CREATE OR REPLACE FUNCTION get_costo_tokens_conjunto(p_organization_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(
    (SELECT COUNT(*)::INTEGER FROM unidades WHERE organization_id = p_organization_id),
    0
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_costo_tokens_conjunto(UUID) IS 'Costo en tokens para una operación en el conjunto. 1 token = 1 unidad de vivienda.';

-- 3. Eliminar columnas obsoletas de organizations (suscripción anual / planes por conjunto)
ALTER TABLE organizations DROP COLUMN IF EXISTS plan_type;
ALTER TABLE organizations DROP COLUMN IF EXISTS plan_active_until;
ALTER TABLE organizations DROP COLUMN IF EXISTS tokens_disponibles;
ALTER TABLE organizations DROP COLUMN IF EXISTS plan_status;
ALTER TABLE organizations DROP COLUMN IF EXISTS is_pilot;
ALTER TABLE organizations DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE organizations DROP COLUMN IF EXISTS subscription_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS last_payment_date;
ALTER TABLE organizations DROP COLUMN IF EXISTS wompi_reference;

-- 4. Trigger opcional: nuevo perfil con 50 tokens si no existe otro perfil del mismo usuario
CREATE OR REPLACE FUNCTION set_tokens_bienvenida()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tokens_disponibles IS NULL OR NEW.tokens_disponibles < 0 THEN
    NEW.tokens_disponibles := 50;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tokens_bienvenida ON profiles;
CREATE TRIGGER trigger_tokens_bienvenida
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_tokens_bienvenida();
