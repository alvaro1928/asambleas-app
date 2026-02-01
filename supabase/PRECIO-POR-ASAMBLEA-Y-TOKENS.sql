-- =====================================================
-- Modelo de negocio: Precio por Asamblea + Tokens
-- =====================================================
-- 1. Tabla planes: cambiar concepto "Precio Anual" → "Precio por Asamblea"
-- 2. Tabla organizations (conjuntos): añadir tokens_disponibles
-- =====================================================

-- 1. Planes: renombrar columna de precio anual a precio por asamblea
ALTER TABLE planes
  RENAME COLUMN precio_cop_anual TO precio_por_asamblea_cop;

COMMENT ON COLUMN planes.precio_por_asamblea_cop IS 'Precio en COP por asamblea (0 = gratis)';

-- 2. Organizations (conjuntos): saldo de asambleas disponibles (no pilot)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tokens_disponibles INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN organizations.tokens_disponibles IS 'Asambleas que el conjunto puede crear sin ser pilot; se descuenta 1 por cada asamblea nueva';
