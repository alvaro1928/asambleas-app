-- =====================================================
-- Configuración de Negocio: precio por token y bono de bienvenida.
-- La app (landing, dashboard) lee estos valores para precios y mensajes.
-- =====================================================

ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS precio_por_token_cop BIGINT;

ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS bono_bienvenida_tokens INTEGER;

COMMENT ON COLUMN configuracion_global.precio_por_token_cop IS 'Precio en COP por token (compra desde la app). Se muestra en landing y dashboard.';
COMMENT ON COLUMN configuracion_global.bono_bienvenida_tokens IS 'Tokens gratuitos que recibe cada nuevo gestor al registrarse (ej. 50).';

UPDATE configuracion_global
SET
  precio_por_token_cop = COALESCE(precio_por_token_cop, 10000),
  bono_bienvenida_tokens = COALESCE(bono_bienvenida_tokens, 50)
WHERE key = 'landing';
